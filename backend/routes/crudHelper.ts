import { Router } from "express";
import { fetchResource, saveResource, fetchSingleItem, saveSingleItem, deleteSingleItem, getDb } from "../../serverDb";

export function createCrudRouter(resourceName: string): Router {
  const router = Router();

  // GET all items
  router.get("/", async (req, res) => {
    try {
      const data = await fetchResource(resourceName);
      res.json(data);
    } catch (err: any) {
      console.error(`[${resourceName} Router] GET Error:`, err);
      res.status(500).json({ error: err.message || `Failed to fetch ${resourceName}` });
    }
  });

  // GET single item by ID
  router.get("/:id", async (req, res) => {
    try {
      const item = await fetchSingleItem(resourceName, req.params.id);
      if (!item) {
        return res.status(404).json({ error: `Item with ID ${req.params.id} not found` });
      }
      res.json(item);
    } catch (err: any) {
      console.error(`[${resourceName} Router] GET /:id Error:`, err);
      res.status(500).json({ error: err.message || `Failed to fetch ${resourceName} item` });
    }
  });

  // POST update/sync items (Supports both array batch sync and single item payload)
  router.post("/", async (req, res) => {
    try {
      const payload = req.body;

      const database = await getDb();
      if (!database) {
        res.setHeader("X-Database-Offline", "true");
      } else {
        res.setHeader("X-Database-Offline", "false");
      }

      if (Array.isArray(payload)) {
        const updated = await saveResource(resourceName, payload);
        return res.json(updated);
      } else if (payload && typeof payload === "object") {
        const updatedItem = await saveSingleItem(resourceName, payload);
        return res.json(updatedItem);
      } else {
        return res.status(400).json({ error: "Invalid payload for POST operation" });
      }
    } catch (err: any) {
      console.error(`[${resourceName} Router] POST Error:`, err);
      res.status(500).json({ error: err.message || `Failed to persist ${resourceName}` });
    }
  });

  // PUT update single item by ID
  router.put("/:id", async (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Invalid item payload" });
      }
      const itemToSave = { ...payload, id: req.params.id };

      const database = await getDb();
      if (!database) {
        res.setHeader("X-Database-Offline", "true");
      } else {
        res.setHeader("X-Database-Offline", "false");
      }

      const updated = await saveSingleItem(resourceName, itemToSave);
      res.json(updated);
    } catch (err: any) {
      console.error(`[${resourceName} Router] PUT /:id Error:`, err);
      res.status(500).json({ error: err.message || `Failed to update ${resourceName} item` });
    }
  });

  // DELETE single item by ID
  router.delete("/:id", async (req, res) => {
    try {
      const database = await getDb();
      if (!database) {
        res.setHeader("X-Database-Offline", "true");
      } else {
        res.setHeader("X-Database-Offline", "false");
      }

      const success = await deleteSingleItem(resourceName, req.params.id);
      res.json({ success, id: req.params.id });
    } catch (err: any) {
      console.error(`[${resourceName} Router] DELETE /:id Error:`, err);
      res.status(500).json({ error: err.message || `Failed to delete ${resourceName} item` });
    }
  });

  return router;
}
