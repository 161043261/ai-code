import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Embeddings } from "@langchain/core/embeddings";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";

interface StoredDocument {
  id: number;
  content: string;
  metadata: string;
  embedding: string;
}

/**
 * 持久化向量存储服务
 * 使用 SQLite 进行向量存储，支持重启后数据保留
 */
@Injectable()
export class PersistentVectorStoreService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PersistentVectorStoreService.name);
  private embeddings: Embeddings;
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const provider = this.configService.get<string>("LLM_PROVIDER", "ollama");
    this.dbPath = this.configService.get<string>(
      "VECTOR_DB_PATH",
      "./data/vectors.db",
    );

    if (provider === "ollama") {
      this.initOllamaEmbeddings();
    } else {
      this.initDashScopeEmbeddings();
    }

    await this.initDatabase();
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private initOllamaEmbeddings() {
    const baseUrl = this.configService.get<string>(
      "OLLAMA_BASE_URL",
      "http://localhost:11434",
    );
    const embeddingModel = this.configService.get<string>(
      "OLLAMA_EMBEDDING_MODEL",
      "nomic-embed-text",
    );

    this.embeddings = new OllamaEmbeddings({
      baseUrl,
      model: embeddingModel,
    });

    this.logger.log(`Ollama embedding configured: ${embeddingModel}`);
  }

  private initDashScopeEmbeddings() {
    const apiKey = this.configService.get<string>("DASHSCOPE_API_KEY");
    const embeddingModel = this.configService.get<string>(
      "DASHSCOPE_EMBEDDING_MODEL",
      "text-embedding-v4",
    );

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey || "mock-key",
      modelName: embeddingModel,
      configuration: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
    });

    this.logger.log(`DashScope embedding configured: ${embeddingModel}`);
  }

  /**
   * 初始化数据库
   */
  private async initDatabase(): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);

      // 创建表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          metadata TEXT,
          embedding TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at)
      `);

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM documents")
        .get() as { count: number };
      this.logger.log(
        `Vector database initialized with ${count.count} documents`,
      );

      this.initialized = true;
    } catch (error) {
      this.logger.error(`Failed to initialize database: ${error.message}`);
      // Fallback: 使用内存模式
      this.db = new Database(":memory:");
      this.db.exec(`
        CREATE TABLE documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          metadata TEXT,
          embedding TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.initialized = true;
      this.logger.warn("Using in-memory database as fallback");
    }
  }

  /**
   * 从目录加载文档
   */
  async loadDocumentsFromDirectory(docsPath: string): Promise<number> {
    if (!fs.existsSync(docsPath)) {
      this.logger.warn(`Documents path not found: ${docsPath}`);
      return 0;
    }

    const documents: Document[] = [];
    const files = fs.readdirSync(docsPath);

    for (const file of files) {
      if (file.endsWith(".md") || file.endsWith(".txt")) {
        const filePath = path.join(docsPath, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          documents.push(
            new Document({
              pageContent: content,
              metadata: {
                source: filePath,
                file_name: file,
              },
            }),
          );
        } catch (error) {
          this.logger.error(`Failed to load ${file}: ${error.message}`);
        }
      }
    }

    if (documents.length === 0) {
      return 0;
    }

    // 分割文档
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(documents);

    // 添加文件名到内容
    const transformedDocs = splitDocs.map((doc) => {
      const fileName = doc.metadata.file_name || "unknown";
      return new Document({
        pageContent: `${fileName}\n${doc.pageContent}`,
        metadata: doc.metadata,
      });
    });

    // 添加到向量存储
    await this.addDocuments(transformedDocs);

    this.logger.log(
      `Loaded ${transformedDocs.length} chunks from ${documents.length} documents`,
    );
    return transformedDocs.length;
  }

  /**
   * 添加文档到向量存储
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.db || documents.length === 0) return;

    const texts = documents.map((doc) => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);

    const stmt = this.db.prepare(`
      INSERT INTO documents (content, metadata, embedding)
      VALUES (?, ?, ?)
    `);

    const insertMany = this.db.transaction(
      (docs: Document[], embeds: number[][]) => {
        for (let i = 0; i < docs.length; i++) {
          stmt.run(
            docs[i].pageContent,
            JSON.stringify(docs[i].metadata),
            JSON.stringify(embeds[i]),
          );
        }
      },
    );

    insertMany(documents, embeddings);
    this.logger.log(`Added ${documents.length} documents to vector store`);
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    query: string,
    maxResults = 5,
    minScore = 0.75,
  ): Promise<Document[]> {
    if (!this.db) return [];

    try {
      // 获取查询向量
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // 获取所有文档
      const rows = this.db
        .prepare("SELECT * FROM documents")
        .all() as StoredDocument[];

      if (rows.length === 0) return [];

      // 计算相似度并排序
      const results: { doc: Document; score: number }[] = [];

      for (const row of rows) {
        const docEmbedding = JSON.parse(row.embedding) as number[];
        const score = this.cosineSimilarity(queryEmbedding, docEmbedding);

        if (score >= minScore) {
          results.push({
            doc: new Document({
              pageContent: row.content,
              metadata: JSON.parse(row.metadata || "{}"),
            }),
            score,
          });
        }
      }

      // 按分数排序并返回前 N 个
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, maxResults).map((r) => r.doc);

      this.logger.debug(
        `Found ${topResults.length} documents for query: ${query.slice(0, 50)}...`,
      );
      return topResults;
    } catch (error) {
      this.logger.error(`Similarity search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 带分数的相似度搜索
   */
  async similaritySearchWithScore(
    query: string,
    maxResults = 5,
  ): Promise<[Document, number][]> {
    if (!this.db) return [];

    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const rows = this.db
        .prepare("SELECT * FROM documents")
        .all() as StoredDocument[];

      if (rows.length === 0) return [];

      const results: [Document, number][] = [];

      for (const row of rows) {
        const docEmbedding = JSON.parse(row.embedding) as number[];
        const score = this.cosineSimilarity(queryEmbedding, docEmbedding);

        results.push([
          new Document({
            pageContent: row.content,
            metadata: JSON.parse(row.metadata || "{}"),
          }),
          score,
        ]);
      }

      results.sort((a, b) => b[1] - a[1]);
      return results.slice(0, maxResults);
    } catch (error) {
      this.logger.error(
        `Similarity search with score failed: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 清空向量存储
   */
  async clear(): Promise<void> {
    if (!this.db) return;
    this.db.exec("DELETE FROM documents");
    this.logger.log("Vector store cleared");
  }

  /**
   * 获取文档数量
   */
  getDocumentCount(): number {
    if (!this.db) return 0;
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM documents")
      .get() as { count: number };
    return result.count;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
