# ai-code

## git worktree

```bash
git worktree add ../ai-code main
```

.git/hooks/pre-commit

```bash
#!/bin/bash

echo "Running Maven code formatter..."

mvn com.spotify.fmt:fmt-maven-plugin:format -q

# Check if formatting made any changes
if ! git diff --quiet; then
  echo "Code was reformatted. Adding changes to commit..."
  git add -u
fi

echo "Formatting complete."
exit 0
```
