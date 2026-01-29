import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {Embeddings} from "@langchain/core/embeddings";

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


  onModuleInit() {

  }
  onModuleDestroy() {
  }
}
