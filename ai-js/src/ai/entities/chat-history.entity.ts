import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("chat_history")
export class ChatHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "memory_id" })
  memoryId: number;

  @Column({ type: "text" })
  role: "user" | "assistant" | "system";

  @Column({ type: "text" })
  content: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
