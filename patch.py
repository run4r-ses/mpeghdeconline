from pathlib import Path

BASE_DIR = Path(__file__).parent

glue_path = BASE_DIR / "js"/ "libmpegh" /"ia_mpeghd_testbench.js"
glue_content = glue_path.read_text()

# patch: add cache bypass
glue_content = glue_content.replace(
    "scriptDirectory+path",
    "scriptDirectory+path+`?cb=${performance.now()}`"
)

glue_path.write_text(glue_content)

print("Patching complete")
