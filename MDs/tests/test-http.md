@markdownai v1.0

# Directive Test: @http - Network Directives

@prompt
@http has three security gates:
1. allowHttp must be true (defaults to false in CLI) - blocks before mock check
2. URL must pass the http security config blocklist
3. Cloud metadata endpoints (169.254.169.254 etc) are always blocked

Since allowHttp=false by default, @http is SILENTLY STRIPPED in standard
mai render output. This is expected behavior - it is NOT a bug.

To verify @http correctly:
- Use the MCP server's read_file tool (which has allowHttp=true by default)
- OR verify that cloud metadata is blocked even when allowHttp=true
@end

---

## Correct @http Syntax (Parse-Time Verification)

The @http directive requires named args - parse this file to confirm no errors:

```
@http url=https://httpbin.org/ip
@http url=https://api.example.com/data method=POST
@http url=https://api.example.com/v1/items @cache mock=fixtures/items.json
```

@prompt
Verify: `mai parse MDs/tests/test-http.md --pretty` should succeed (exit 0)
and return a valid AST. The @http nodes should appear in the parsed output.
No parse errors means the syntax is correctly understood.
@end

---

## @http in CLI (silently stripped when allowHttp=false)

This directive produces no output in standard mai render:
@http url=https://httpbin.org/ip

And neither does the mock cache variant (mock is unreachable when allowHttp=false):
@http url=https://httpbin.org/ip @cache mock=fixtures/httpbin-ip.json

@prompt
Verify: BOTH lines above produce no output. No error, no content. That is
correct behavior - @http is silently stripped when allowHttp is false.
@end

---

## Security: Cloud Metadata Always Blocked

@http url=http://169.254.169.254/latest/meta-data/
@http url=http://metadata.google.internal/computeMetadata/v1/
@http url=http://169.254.169.254/metadata/instance

@prompt
Verify: All three lines above produce no output. Even if allowHttp were true,
these endpoints must be blocked by the always_block tier in httpConfig.

To verify the SECURITY_ALERT path: run with allowHttp=true (in a test or via MCP).
The engine must emit a SECURITY_ALERT warning. No content from these URLs
should ever appear.
@end

---

## @http via MCP (live requests work here)

When Claude reads this file via the read_file MCP tool, the server runs with
allowHttp=true. The following directive should return live JSON:

@http url=https://httpbin.org/get

@prompt
If reading via MCP: A JSON response body should appear above containing headers,
url, and origin fields from httpbin.org.

If reading via mai render (CLI): No output above - that is expected.
@end
