import { promises as fs } from "fs";
import path from "path";

export async function readJson(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw || "[]");
}

export async function writeJson(relativePath, data) {
  const filePath = path.join(process.cwd(), relativePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
