使用本地 Ollama（默认）

```bash
# 1. 安装并启动 Ollama
ollama serve

# 2. 拉取模型
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 3. 启动项目
cd ai-js
cp .env.example .env
npm install
npm run start:dev
```
