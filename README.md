# ai-code

.git/hooks/pre-commit

```bash
#!/bin/bash

echo "Running Maven code formatter..."

# Run the formatter
mvn com.spotify.fmt:fmt-maven-plugin:format -q

# Check if formatting made any changes
if ! git diff --quiet; then
    echo "Code was reformatted. Adding changes to commit..."
    git add -u
fi

echo "Formatting complete."
exit 0
```
