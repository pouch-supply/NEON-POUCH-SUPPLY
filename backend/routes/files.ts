import { Router } from "express";
import { fetchResource, saveResource, deleteSingleItem, getDb } from "../../serverDb";

const router = Router();

// GET all files
router.get("/", async (req, res) => {
  try {
    const data = await fetchResource("files");
    res.json(data);
  } catch (err: any) {
    console.error("[Files Router] GET Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch files" });
  }
});

// POST update/sync files
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ error: "Files API expects an array of documents" });
    }

    const database = await getDb();
    if (!database) {
      res.setHeader("X-Database-Offline", "true");
    } else {
      res.setHeader("X-Database-Offline", "false");
    }

    const updated = await saveResource("files", payload);
    res.json(updated);
  } catch (err: any) {
    console.error("[Files Router] POST Error:", err);
    res.status(500).json({ error: err.message || "Failed to persist files" });
  }
});

// DELETE single file by id or url
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteSingleItem("files", id);
    const updated = await fetchResource("files");
    res.json(updated);
  } catch (err: any) {
    console.error("[Files Router] DELETE Error:", err);
    res.status(500).json({ error: err.message || "Failed to delete file" });
  }
});

export default router;
