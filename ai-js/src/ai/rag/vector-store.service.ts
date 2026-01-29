import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Embeddings } from '@langchain/core/embeddings';
import Sqlite3, { Database } from 'better-sqlite3';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import { dirname } from 'path';
import { existsSync } from 'node:fs';
import { mkdirSync } from 'fs';
import { count } from 'rxjs';

interface StoredDocument {
  id: string;
  content: string;
  metadata: string;
  embedding: string;
}

@Injectable()
export class VectorStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VectorStoreService.name);
  private embeddings: Embeddings;
  private db: Database | null = null;
  private dbPath: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'ollama');
    this.dbPath = this.configService.get<string>(
      'VECTOR_DB_PATH',
      './data/vectors.db',
    );

    if (provider === 'ollama') {
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
      'OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    const embeddingModel = this.configService.get<string>(
      'OLLAMA_EMBEDDING_MODEL',
      'nomic-embed-text',
    );
    this.embeddings = new OllamaEmbeddings({
      baseUrl,
      model: embeddingModel,
    });
    this.logger.log(`Ollama embedding initialized: ${embeddingModel}`);
  }

  private initDashScopeEmbeddings() {
    const apiKey = this.configService.get<string>('DASHSCOPE_API_KEY');
    const embeddingModel = this.configService.get<string>(
      'DASHSCOPE_EMBEDDING_MODEL',
      'text-embedding-v4',
    );
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: embeddingModel,
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
    });
    this.logger.log(`DashScope embedding initialized: ${embeddingModel}`);
  }

  private async initDatabase() {
    try {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.db = new Sqlite3(this.dbPath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents
        (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          content    TEXT NOT NULL,
          metadata   TEXT,
          embedding  TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at);
      `);
      const { count } = this.db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM documents;
      `,
        )
        .get() as { count: number };
      this.logger.log(`Vector database initialized with ${count} documents`);
    } catch (err) {
      this.logger.log('Failed to initialize database:', err);
      this.db = new Sqlite3(':memory:');
      this.db.exec(`
        CREATE TABLE documents
            (
              id         INTEGER PRIMARY KEY AUTOINCREMENT,
              content    TEXT NOT NULL,
              metadata   TEXT,
              embedding  TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
     `);
      this.logger.warn('Fallback to memory database');
    }
  }

  async loadDocumentsFromDirectory(docsPath: string): Promise<number> {}
}
