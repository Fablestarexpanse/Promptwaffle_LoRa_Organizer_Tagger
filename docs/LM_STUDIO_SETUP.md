# LM Studio Setup Guide for LoRA Dataset Studio

This guide walks you through setting up LM Studio for AI image captioning in LoRA Dataset Studio.

## Prerequisites

- **LM Studio** — Free desktop app for running LLMs locally
- **Vision model** — A model that can "see" images (e.g. LLaVA, Llama-3.2-Vision)
- **RAM/VRAM** — At least 8 GB RAM; GPU recommended for faster captioning (8–24 GB VRAM for larger models)

---

## Step 1: Install LM Studio

1. Go to [https://lmstudio.ai/](https://lmstudio.ai/)
2. Download LM Studio for your operating system
3. Install and launch LM Studio

---

## Step 2: Download a Vision Model

You need a **vision** (multimodal) model that can process images. Recommended options:

### Option A: LLaVA 1.5 (Good balance of speed and quality)

1. In LM Studio, open **Search** (magnifying glass icon) or press `Ctrl+L` / `Cmd+L`
2. Search for: **llava** or **llava-v1.5-7b**
3. Select a model (e.g. **llava-v1.5-7b**, **llava-v1.5-13b** for better quality, or **llava-v1.6-34b** if you have enough VRAM)
4. Click **Download** and choose a quantized version (Q4_K_M or Q5_K_M are good defaults)
5. Wait for the download to finish

### Option B: Llama 3.2 Vision (Larger, newer)

1. Search for: **llama 3.2 vision** or **llama-3.2-11b-vision**
2. Download a quantized version that fits your VRAM
3. Llama 3.2 Vision often gives higher quality captions but needs more RAM/VRAM

### Option C: Other vision models

Any vision model in LM Studio’s hub that supports image input will work. Check the model card for "vision" or "image" support.

---

## Step 3: Load the Model

1. In LM Studio, go to the **Chat** (or **Load Model**) screen
2. In the left sidebar, find your downloaded vision model
3. Click it to load it into memory
4. Wait until the model is fully loaded (you’ll see a green indicator or the chat interface)

---

## Step 4: Start the Local Server

LM Studio must be running a local server so LoRA Dataset Studio can connect.

### Via LM Studio UI

1. In LM Studio, open the **Local Server** tab (or the developer/server icon)
2. Ensure your vision model is selected
3. Click **Start Server** (or **Serve**)
4. The server usually runs at **http://localhost:1234** (the default)
5. Leave LM Studio running and the server started

### Via LM Studio CLI (optional)

If you use the LM Studio CLI:

```bash
lms server start
```

Use `lms server start --port 1234` if you need a specific port.

---

## Step 5: Connect LoRA Dataset Studio

1. Open **LoRA Dataset Studio**
2. Open a folder with images
3. Click the **AI** tab in the right panel
4. Select **LM Studio** as the AI provider
5. Check the **LM Studio URL** — it should be `http://localhost:1234` (or your custom URL)
6. Click **Test** — you should see a green connection status and a list of models
7. In the **Model** dropdown, choose your loaded vision model
8. (Optional) Edit the **Custom prompt** or pick a template (e.g. "Descriptive", "Booru Tags", "LoRA Training Caption")

---

## Step 6: Generate Captions

### Single image

1. Select an image in the grid
2. Make sure the AI tab is visible with LM Studio selected
3. Click **Generate Caption**
4. The caption will appear in the editor; you can edit before saving

### Batch captioning

1. Choose what to caption:
   - **All** — every image
   - **Good / Bad / Needs Edit** — only images with those ratings
   - Or leave all unchecked — uncaptioned images only (or selected images if you’ve multi-selected)
2. Click **Batch** to caption all matching images
3. Watch the progress bar; you can click **Stop** to cancel

---

## Troubleshooting

### "Connection failed" or Test fails

- Ensure LM Studio is running and the local server is started
- Confirm the URL is `http://localhost:1234` (or your actual URL)
- Restart the LM Studio server if needed
- Make sure no firewall is blocking localhost

### No models in the dropdown

- Load a model in LM Studio first (Chat / Load Model)
- Start the local server
- Click **Test** again in LoRA Dataset Studio

### Captions are empty or poor quality

- Use a vision model (e.g. LLaVA, Llama 3.2 Vision), not a text-only model
- Try a different prompt (e.g. "Write a long detailed description for this image.")
- Use a larger model (e.g. 13B instead of 7B) if you have enough VRAM

### Slow captioning

- Use a GPU if available
- Use a smaller quantized model (Q4 instead of Q8)
- Batch size in LoRA Dataset Studio is limited to avoid overloading LM Studio

---

## Quick Reference

| Setting      | Default / typical value      |
|-------------|------------------------------|
| LM Studio URL | `http://localhost:1234`    |
| Port        | 1234                         |
| API format  | OpenAI-compatible            |
| Endpoints   | `/v1/models`, `/v1/chat/completions` |

---

## More Information

- [LM Studio Documentation](https://lmstudio.ai/docs/)
- [LM Studio Local Server Guide](https://lmstudio.ai/docs/developer/core/server)
- [LM Studio Model Hub](https://lmstudio.ai/models) — search for vision models
