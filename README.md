# ai-code

## git worktree

```bash
git worktree add ../ai-code main
```

.git/hooks/pre-commit

```bash
#!/bin/bash

echo "run mvn fmt:format"

mvn com.spotify.fmt:fmt-maven-plugin:format -q

if ! git diff --quiet; then
  echo "run git add -u"
  git add -u
fi

echo "format ok"
exit 0
```

- 多模态
- 系统提示词
- 会话记忆
- 结构化输出 (JSON)
  - 大模型 JSON schema
  - Prompt + JSON Mode
  - Prompt
