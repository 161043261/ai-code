import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class ChatRequestDto {
  @ApiProperty({ description: "会话ID" })
  @IsNumber()
  memoryId: number;

  @ApiProperty({ description: "用户消息" })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatSyncRequestDto {
  @ApiProperty({ description: "用户消息" })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatResponseDto {
  @ApiProperty({ description: "AI响应内容" })
  content: string;

  @ApiProperty({ description: "来源文档", required: false })
  @IsOptional()
  sources?: string[];
}

export class ReportDto {
  @ApiProperty({ description: "报告名称" })
  name: string;

  @ApiProperty({ description: "建议列表" })
  suggestionList: string[];
}
