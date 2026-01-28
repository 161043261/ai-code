import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Embeddings } from "@langchain/core/embeddings";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: Embeddings;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const provider = this.configService.get<string>("LLM_PROVIDER", "ollama");

    if (provider === "ollama") {
      this.initOllamaEmbeddings();
    } else {
      this.initDashScopeEmbeddings();
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

    this.logger.log(
      `Ollama embedding configured: ${embeddingModel} at ${baseUrl}`,
    );
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

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const docsPath = path.join(__dirname, "../../../resources/docs");
      const documents = await this.loadDocuments(docsPath);

      if (documents.length === 0) {
        this.logger.warn("No documents found for RAG");
        this.initialized = true;
        return;
      }

      // Split documents
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const splitDocs = await splitter.splitDocuments(documents);

      // Transform: add file name to content for better search
      const transformedDocs = splitDocs.map((doc) => {
        const fileName = doc.metadata.source?.split("/").pop() || "unknown";
        return new Document({
          pageContent: `${fileName}\n${doc.pageContent}`,
          metadata: doc.metadata,
        });
      });

      // Create vector store
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        transformedDocs,
        this.embeddings,
      );

      this.initialized = true;
      this.logger.log(
        `RAG initialized with ${transformedDocs.length} chunks from ${documents.length} documents`,
      );
    } catch (error) {
      this.logger.error(`Failed to initialize RAG: ${error.message}`);
      this.initialized = true; // Mark as initialized to prevent retry loops
    }
  }

  private async loadDocuments(docsPath: string): Promise<Document[]> {
    const documents: Document[] = [];

    if (!fs.existsSync(docsPath)) {
      this.logger.warn(`Documents path not found: ${docsPath}`);
      return documents;
    }

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
          this.logger.debug(`Loaded document: ${file}`);
        } catch (error) {
          this.logger.error(`Failed to load ${file}: ${error.message}`);
        }
      }
    }

    return documents;
  }

  /**
   * 检索相关文档
   */
  async retrieve(
    query: string,
    maxResults = 5,
    minScore = 0.75,
  ): Promise<Document[]> {
    if (!this.vectorStore) {
      return [];
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        maxResults,
      );

      // Filter by minimum score
      const filteredResults = results
        .filter(([, score]) => score >= minScore)
        .map(([doc]) => doc);

      this.logger.debug(
        `Retrieved ${filteredResults.length} documents for query: ${query.slice(0, 50)}...`,
      );
      return filteredResults;
    } catch (error) {
      this.logger.error(`Retrieval failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 添加新文档
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.vectorStore) {
      this.logger.warn("Vector store not initialized");
      return;
    }

    await this.vectorStore.addDocuments(documents);
    this.logger.log(`Added ${documents.length} documents to vector store`);
  }
}
