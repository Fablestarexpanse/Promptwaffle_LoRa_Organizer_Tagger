import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import {
  Sparkles,
  Wifi,
  WifiOff,
  Play,
  Loader2,
  Check,
  X,
  Download,
  Trash2,
  CheckCircle,
  Square,
} from "lucide-react";
import { useAiStore } from "@/stores/aiStore";
import { useUiStore } from "@/stores/uiStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useProjectImages } from "@/hooks/useProject";
import {
  testLmStudioConnection,
  testOllamaConnection,
  generateCaptionLmStudio,
  generateCaptionsBatch,
  generateCaptionJoyCaption,
  generateCaptionsJoyCaptionBatch,
  generateCaptionWd14,
  writeCaption,
  joycaptionInstallStatus,
  joycaptionInstall,
  joycaptionUninstall,
  joycaptionDiagnose,
  type JoyCaptionInstallProgress,
} from "@/lib/tauri";

export function AiPanel() {
  const [previewCaption, setPreviewCaption] = useState<string | null>(null);
  const [diagnoseResult, setDiagnoseResult] = useState<Awaited<ReturnType<typeof joycaptionDiagnose>> | null>(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const cancelBatchRef = useRef(false);

  const queryClient = useQueryClient();
  const rootPath = useProjectStore((s) => s.rootPath);
  const selectedImage = useSelectionStore((s) => s.selectedImage);
  const { data: images = [] } = useProjectImages();

  const {
    provider,
    setProvider,
    customPrompt,
    setCustomPrompt,
    lmStudio,
    setLmStudioUrl,
    setLmStudioModel,
    ollama,
    setOllamaBaseUrl,
    setOllamaModel,
    wd14,
    setWd14PythonPath,
    setWd14ScriptPath,
    joyCaption,
    setJoyCaptionPythonPath,
    setJoyCaptionScriptPath,
    setJoyCaptionMode,
    setJoyCaptionLowVram,
    promptTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    isConnected,
    availableModels,
    setConnectionStatus,
    isGenerating,
    setIsGenerating,
    generationProgress,
    setGenerationProgress,
    batchCaptionRatingFilter,
    batchCaptionRatingAll,
    setBatchCaptionRatingAll,
    toggleBatchCaptionRating,
  } = useAiStore();

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const showToast = useUiStore((s) => s.showToast);

  const [installProgress, setInstallProgress] = useState<JoyCaptionInstallProgress | null>(null);

  const selectedTemplate = promptTemplates.find((t) => t.id === selectedTemplateId);

  // JoyCaption install status (when provider is JoyCaption)
  const { data: joyCaptionInstallStatusData, refetch: refetchJoyCaptionStatus } = useQuery({
    queryKey: ["joycaption-install-status"],
    queryFn: joycaptionInstallStatus,
    enabled: provider === "joycaption",
  });

  const joyCaptionReady =
    provider !== "joycaption" ||
    joyCaptionInstallStatusData?.installed === true ||
    (joyCaption.script_path != null && joyCaption.script_path !== "");

  const wd14Ready =
    provider !== "wd14" ||
    (wd14.script_path != null && wd14.script_path !== "");

  const hybridReady =
    provider !== "hybrid" ||
    ((wd14.script_path != null && wd14.script_path !== "") && joyCaptionReady);

  // Listen for install progress events
  useEffect(() => {
    const unlisten = listen<JoyCaptionInstallProgress>(
      "joycaption-install-progress",
      (event) => setInstallProgress(event.payload)
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Install JoyCaption mutation
  const installJoyCaptionMutation = useMutation({
    mutationFn: joycaptionInstall,
    onSuccess: (result) => {
      setInstallProgress(null);
      if (result.success && result.python_path) setJoyCaptionPythonPath(result.python_path);
      if (result.success && result.script_path) setJoyCaptionScriptPath(result.script_path);
      refetchJoyCaptionStatus();
    },
    onError: () => setInstallProgress(null),
  });

  // JoyCaption uninstall
  const uninstallJoyCaptionMutation = useMutation({
    mutationFn: joycaptionUninstall,
    onSuccess: (result) => {
      setShowUninstallConfirm(false);
      if (result.success) {
        showToast(result.message);
        refetchJoyCaptionStatus();
      } else {
        showToast(result.message);
      }
    },
    onError: (err) => {
      setShowUninstallConfirm(false);
      showToast(String(err));
    },
  });

  // JoyCaption diagnostic test (paths passed when invoking)
  const diagnoseMutation = useMutation({
    mutationFn: ({
      pythonPath,
      scriptPath,
    }: {
      pythonPath: string;
      scriptPath: string;
    }) => joycaptionDiagnose(pythonPath, scriptPath),
    onSuccess: (result) => setDiagnoseResult(result),
    onError: (err) =>
      setDiagnoseResult({
        ok: false,
        python_exists: false,
        script_exists: false,
        stdout: "",
        stderr: "",
        exit_code: null,
        error: String(err),
      }),
  });

  // Test connection mutation (LM Studio or Ollama)
  const testConnectionMutation = useMutation({
    mutationFn: () =>
      provider === "ollama"
        ? testOllamaConnection(ollama.base_url)
        : testLmStudioConnection(lmStudio.base_url),
    onSuccess: (status) => {
      setConnectionStatus(status.connected, status.models);
      if (status.models.length > 0) {
        if (provider === "ollama" && !ollama.model) {
          setOllamaModel(status.models[0]);
        } else if (provider === "lm_studio" && !lmStudio.model) {
          setLmStudioModel(status.models[0]);
        }
      }
    },
  });

  // Get the effective prompt to use
  const effectivePrompt = customPrompt.trim() || selectedTemplate?.prompt || "Describe this image.";

  // Use install-status paths when JoyCaption is installed (fixes "doing nothing" when store has wrong paths)
  const joyCaptionPython =
    joyCaptionInstallStatusData?.installed && joyCaptionInstallStatusData?.python_path
      ? joyCaptionInstallStatusData.python_path
      : joyCaption.python_path;
  const joyCaptionScript =
    joyCaptionInstallStatusData?.installed && joyCaptionInstallStatusData?.script_path
      ? joyCaptionInstallStatusData.script_path
      : joyCaption.script_path;

  // Generate single caption mutation
  const generateSingleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedImage) return null;

      if (provider === "lm_studio" || provider === "ollama") {
        const baseUrl = provider === "ollama" ? ollama.base_url : lmStudio.base_url;
        const model = provider === "ollama" ? ollama.model : lmStudio.model;
        return generateCaptionLmStudio(
          selectedImage.path,
          baseUrl,
          model,
          effectivePrompt
        );
      }
      if (provider === "wd14") {
        return generateCaptionWd14(
          selectedImage.path,
          wd14.python_path,
          wd14.script_path
        );
      }
      if (provider === "hybrid") {
        const wd14Result = await generateCaptionWd14(
          selectedImage.path,
          wd14.python_path,
          wd14.script_path
        );
        const joyResult = await generateCaptionJoyCaption(
          selectedImage.path,
          joyCaptionPython,
          joyCaptionScript,
          joyCaption.mode,
          joyCaption.low_vram
        );
        const wd14Tags = wd14Result.success && wd14Result.caption ? wd14Result.caption.trim() : "";
        const joyCaptionText = joyResult.success && joyResult.caption ? joyResult.caption.trim() : "";
        const merged = [wd14Tags, joyCaptionText].filter(Boolean).join(", ");
        return { success: !!merged, caption: merged, error: null as string | null };
      }
      return generateCaptionJoyCaption(
        selectedImage.path,
        joyCaptionPython,
        joyCaptionScript,
        joyCaption.mode,
        joyCaption.low_vram
      );
    },
    onSuccess: (result) => {
      if (result?.success) {
        setPreviewCaption(result.caption);
      } else if (result?.error) {
        showToast(result.error);
      }
    },
    onError: (err: Error) => {
      showToast(err.message);
    },
  });

  // Accept caption and save
  async function handleAcceptCaption() {
    if (!selectedImage || !previewCaption) return;
    const tags = previewCaption
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    await writeCaption(selectedImage.path, tags);
    setPreviewCaption(null);
    if (rootPath) {
      queryClient.invalidateQueries({ queryKey: ["project", "images", rootPath] });
    }
  }

  // Batch generation - uses selected images if any, otherwise uncaptioned
  // When rating filter is set, only process images with those ratings
  async function handleBatchGenerate() {
    let baseImages: typeof images;
    if (batchCaptionRatingAll) {
      baseImages = images;
    } else if (batchCaptionRatingFilter.size > 0) {
      baseImages = images.filter((img) =>
        batchCaptionRatingFilter.has(img.rating)
      );
    } else {
      baseImages =
        selectedIds.size > 0
          ? images.filter((img) => selectedIds.has(img.id))
          : images.filter((img) => !img.has_caption);
    }
    const targetImages = baseImages;

    if (targetImages.length === 0) {
      showToast("No images to caption. Select images, check All, or pick Good/Bad/Needs Edit.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0, targetImages.length);
    cancelBatchRef.current = false;

    try {
      if (provider === "wd14" || provider === "hybrid") {
        // WD14 and Hybrid: no batch API, process one image at a time
          for (let i = 0; i < targetImages.length; i++) {
          if (cancelBatchRef.current) break;
          const img = targetImages[i];
          try {
            let caption = "";
            if (provider === "wd14") {
              const result = await generateCaptionWd14(img.path, wd14.python_path, wd14.script_path);
              if (result.success && result.caption) caption = result.caption;
            } else {
              const wd14Result = await generateCaptionWd14(img.path, wd14.python_path, wd14.script_path);
              const joyResult = await generateCaptionJoyCaption(
                img.path,
                joyCaptionPython,
                joyCaptionScript,
                joyCaption.mode,
                joyCaption.low_vram
              );
              const wd14Tags = wd14Result.success && wd14Result.caption ? wd14Result.caption.trim() : "";
              const joyText = joyResult.success && joyResult.caption ? joyResult.caption.trim() : "";
              caption = [wd14Tags, joyText].filter(Boolean).join(", ");
            }
            if (caption) {
              const tags = caption.split(",").map((t) => t.trim()).filter((t) => t);
              await writeCaption(img.path, tags);
            }
          } catch (e) {
            showToast(String(e instanceof Error ? e.message : e));
          }
          setGenerationProgress(i + 1, targetImages.length);
        }
      } else {
        const chunkSize = provider === "joycaption" ? 20 : 5;
        for (let i = 0; i < targetImages.length; i += chunkSize) {
          if (cancelBatchRef.current) break;

          const chunk = targetImages.slice(i, i + chunkSize);
          const paths = chunk.map((img) => img.path);

          let results;
          if (provider === "lm_studio" || provider === "ollama") {
            const baseUrl = provider === "ollama" ? ollama.base_url : lmStudio.base_url;
            const model = provider === "ollama" ? ollama.model : lmStudio.model;
            results = await generateCaptionsBatch(
              paths,
              baseUrl,
              model,
              effectivePrompt
            );
          } else {
            results = await generateCaptionsJoyCaptionBatch(
              paths,
              joyCaptionPython,
              joyCaptionScript,
              joyCaption.mode,
              joyCaption.low_vram
            );
          }

          let failed = 0;
          let firstError: string | null = null;
          for (const result of results) {
            if (result.success && result.caption) {
              const tags = result.caption
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t);
              await writeCaption(result.path, tags);
            } else {
              failed++;
              if (!firstError && result.error) firstError = result.error;
            }
          }

          if (failed > 0 && firstError) {
            showToast(
              `${failed} of ${results.length} failed: ${firstError.slice(0, 200)}${firstError.length > 200 ? "…" : ""}`
            );
          }

          setGenerationProgress(Math.min(i + chunkSize, targetImages.length), targetImages.length);
        }
      }
    } catch (err) {
      showToast(String(err instanceof Error ? err.message : err));
    } finally {
      cancelBatchRef.current = false;
      setIsGenerating(false);
      if (rootPath) {
        queryClient.invalidateQueries({ queryKey: ["project", "images", rootPath] });
      }
    }
  }

  function handleStopCaptioning() {
    cancelBatchRef.current = true;
  }

  const uncaptionedCount = images.filter((img) => !img.has_caption).length;
  let batchTargetImages: typeof images;
  if (batchCaptionRatingAll) {
    batchTargetImages = images;
  } else if (batchCaptionRatingFilter.size > 0) {
    // Good/Bad/Needs Edit = all images with those ratings
    batchTargetImages = images.filter((img) =>
      batchCaptionRatingFilter.has(img.rating)
    );
  } else {
    batchTargetImages =
      selectedIds.size > 0
        ? images.filter((img) => selectedIds.has(img.id))
        : images.filter((img) => !img.has_caption);
  }
  const batchTargetCount = batchTargetImages.length;
  const batchLabel =
    batchCaptionRatingAll
      ? `${batchTargetCount} (all)`
      : batchCaptionRatingFilter.size > 0
        ? `${batchTargetCount} (rating filter)`
        : selectedIds.size > 0
          ? `${selectedIds.size} selected`
          : `${uncaptionedCount} uncaptioned`;

  return (
    <div className="flex flex-col border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">AI Captioning</span>
        </div>
        {(provider === "lm_studio" || provider === "ollama") &&
          (isConnected ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-gray-500" />
          ))}
      </div>

      {/* Provider selector */}
      <div className="border-b border-border p-3">
        <label className="mb-1 block text-xs text-gray-500">AI Provider</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProvider("lm_studio")}
            className={`min-w-[6rem] flex-1 shrink-0 whitespace-nowrap rounded px-2 py-2 text-xs font-medium ${
              provider === "lm_studio"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            LM Studio
          </button>
          <button
            type="button"
            onClick={() => setProvider("ollama")}
            className={`min-w-[6rem] flex-1 shrink-0 whitespace-nowrap rounded px-2 py-2 text-xs font-medium ${
              provider === "ollama"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Ollama
          </button>
          <button
            type="button"
            onClick={() => setProvider("wd14")}
            className={`min-w-[6rem] flex-1 shrink-0 whitespace-nowrap rounded px-2 py-2 text-xs font-medium ${
              provider === "wd14"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            WD14
          </button>
          <button
            type="button"
            onClick={() => setProvider("hybrid")}
            className={`min-w-[6rem] flex-1 shrink-0 whitespace-nowrap rounded px-2 py-2 text-xs font-medium ${
              provider === "hybrid"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Hybrid
          </button>
          <button
            type="button"
            onClick={() => setProvider("joycaption")}
            className={`min-w-[6rem] flex-1 shrink-0 whitespace-nowrap rounded px-2 py-2 text-xs font-medium ${
              provider === "joycaption"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            JoyCaption
          </button>
        </div>
      </div>

      {/* Provider-specific settings (inline when provider selected) */}
      <div className="space-y-3 border-b border-border bg-surface/50 p-3">
        {provider === "lm_studio" ? (
            <>
              {/* LM Studio URL */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">LM Studio URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lmStudio.base_url}
                    onChange={(e) => setLmStudioUrl(e.target.value)}
                    className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                    placeholder="http://localhost:1234"
                  />
                  <button
                    type="button"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {testConnectionMutation.isPending ? "..." : "Test"}
                  </button>
                </div>
              </div>

              {/* Model selector */}
              {availableModels.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Model</label>
                  <select
                    value={lmStudio.model || ""}
                    onChange={(e) => setLmStudioModel(e.target.value || null)}
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
        ) : provider === "ollama" ? (
            <>
              {/* Ollama URL */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">Ollama URL (OpenAI-compatible)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollama.base_url}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                    placeholder="http://localhost:11434/v1"
                  />
                  <button
                    type="button"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {testConnectionMutation.isPending ? "..." : "Test"}
                  </button>
                </div>
              </div>

              {/* Model selector */}
              {availableModels.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Model (e.g. llava, llava:13b)</label>
                  <select
                    value={ollama.model || ""}
                    onChange={(e) => setOllamaModel(e.target.value || null)}
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
        ) : provider === "wd14" ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Python Path</label>
                <input
                  type="text"
                  value={wd14.python_path}
                  onChange={(e) => setWd14PythonPath(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="python"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">WD14 Script Path</label>
                <input
                  type="text"
                  value={wd14.script_path ?? ""}
                  onChange={(e) => setWd14ScriptPath(e.target.value || null)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="path/to/wd14_tagger.py"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Script must accept --image &lt;path&gt; and print comma-separated tags to stdout.
                </p>
              </div>
            </>
        ) : provider === "hybrid" ? (
            <>
              <p className="text-xs text-gray-500">Hybrid uses WD14 (tags) + JoyCaption (description).</p>
              <div>
                <label className="mb-1 block text-xs text-gray-500">WD14 Script Path</label>
                <input
                  type="text"
                  value={wd14.script_path ?? ""}
                  onChange={(e) => setWd14ScriptPath(e.target.value || null)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="path/to/wd14_tagger.py"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">JoyCaption Python / Script</label>
                <input
                  type="text"
                  value={joyCaption.python_path}
                  onChange={(e) => setJoyCaptionPythonPath(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="python"
                />
                <input
                  type="text"
                  value={joyCaption.script_path ?? ""}
                  onChange={(e) => setJoyCaptionScriptPath(e.target.value || null)}
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="JoyCaption script path (optional)"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">JoyCaption Mode</label>
                <select
                  value={joyCaption.mode}
                  onChange={(e) => setJoyCaptionMode(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                >
                  <option value="descriptive">Descriptive</option>
                  <option value="straightforward">Straightforward</option>
                  <option value="booru">Booru Tags</option>
                  <option value="training">Training Caption</option>
                </select>
              </div>
            </>
        ) : provider === "joycaption" ? (
            <>
              {/* JoyCaption Python Path */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">Python Path</label>
                <input
                  type="text"
                  value={joyCaption.python_path}
                  onChange={(e) => setJoyCaptionPythonPath(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="python"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Script Path (optional, uses Install if blank)</label>
                <input
                  type="text"
                  value={joyCaption.script_path ?? ""}
                  onChange={(e) => setJoyCaptionScriptPath(e.target.value || null)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                  placeholder="path/to/joycaption_inference.py"
                />
              </div>

              {/* JoyCaption Mode */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">Caption Mode</label>
                <select
                  value={joyCaption.mode}
                  onChange={(e) => setJoyCaptionMode(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
                >
                  <option value="descriptive">Descriptive</option>
                  <option value="straightforward">Straightforward</option>
                  <option value="booru">Booru Tags</option>
                  <option value="training">Training Caption</option>
                </select>
              </div>

              {/* Low VRAM toggle */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={joyCaption.low_vram}
                  onChange={(e) => setJoyCaptionLowVram(e.target.checked)}
                  className="rounded border-gray-600"
                />
                <span className="text-sm text-gray-300">Low VRAM mode</span>
              </label>
            </>
          ) : null}
        </div>

      {/* Prompt template selector (LM Studio and Ollama) */}
      {(provider === "lm_studio" || provider === "ollama") && (
        <div className="border-b border-border p-3">
          <label className="mb-1 block text-xs text-gray-500">Prompt Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              const template = promptTemplates.find((t) => t.id === e.target.value);
              if (template) setCustomPrompt(template.prompt);
            }}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-gray-200"
          >
            {promptTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom prompt input */}
      <div className="border-b border-border p-3">
        <label className="mb-1 block text-xs text-gray-500">
          {["joycaption", "wd14", "hybrid"].includes(provider)
            ? "Custom Prompt (LM Studio / Ollama only)"
            : "Custom Prompt"}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Enter your custom prompt..."
          rows={3}
          disabled={["joycaption", "wd14", "hybrid"].includes(provider)}
          className="w-full resize-none rounded border border-border bg-surface px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        {provider === "joycaption" && (
          <p className="mt-1 text-xs text-gray-500">JoyCaption uses the Mode setting above instead of a custom prompt.</p>
        )}
      </div>

      {/* Batch captioning: rating filter */}
      <div className="border-b border-border p-3">
        <label className="mb-1 block text-xs text-gray-500">
          Only caption images rated:
        </label>
        <div className="flex flex-wrap gap-2">
          <label
            className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1.5 text-xs hover:bg-white/5 ${
              batchCaptionRatingAll
                ? "border-green-500 bg-green-500/20 text-green-300"
                : "border-border bg-surface text-gray-300"
            }`}
          >
            <input
              type="checkbox"
              checked={batchCaptionRatingAll}
              onChange={(e) => setBatchCaptionRatingAll(e.target.checked)}
              className="rounded border-gray-600"
            />
            <span>All</span>
          </label>
          {(["good", "bad", "needs_edit"] as const).map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-border bg-surface px-2 py-1.5 text-xs text-gray-300 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={!batchCaptionRatingAll && batchCaptionRatingFilter.has(r)}
                onChange={() => toggleBatchCaptionRating(r)}
                disabled={batchCaptionRatingAll}
                className="rounded border-gray-600 disabled:opacity-50"
              />
              <span className="capitalize">{r.replace("_", " ")}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          All = every image in project (re-caption). Otherwise: selected/uncaptioned + rating.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2 p-3">
        {/* Single image caption */}
        <button
          type="button"
          onClick={() => generateSingleMutation.mutate()}
          disabled={
            !selectedImage ||
            ((provider === "lm_studio" || provider === "ollama") && !isConnected) ||
            (provider === "joycaption" && !joyCaptionReady) ||
            (provider === "wd14" && !wd14Ready) ||
            (provider === "hybrid" && !hybridReady) ||
            generateSingleMutation.isPending
          }
          className="flex w-full items-center justify-center gap-2 rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {generateSingleMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Caption
        </button>

        {/* Batch caption / Stop */}
        {isGenerating ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStopCaptioning}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
              <span className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-300">
                {generationProgress.current}/{generationProgress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full bg-purple-600 transition-all duration-300"
                style={{
                  width: generationProgress.total
                    ? `${(100 * generationProgress.current) / generationProgress.total}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleBatchGenerate}
            disabled={
              batchTargetCount === 0 ||
              ((provider === "lm_studio" || provider === "ollama") && !isConnected) ||
              (provider === "joycaption" && !joyCaptionReady) ||
              (provider === "wd14" && !wd14Ready) ||
              (provider === "hybrid" && !hybridReady)
            }
            className="flex w-full items-center justify-center gap-2 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Batch ({batchLabel})
          </button>
        )}
      </div>

      {/* Preview */}
      {previewCaption && (
        <div className="border-t border-border p-3">
          <p className="mb-2 text-xs font-medium text-gray-400">Preview</p>
          <p className="mb-2 text-sm text-gray-200">{previewCaption}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAcceptCaption}
              className="flex flex-1 items-center justify-center gap-1 rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-500"
            >
              <Check className="h-4 w-4" />
              Accept
            </button>
            <button
              type="button"
              onClick={() => setPreviewCaption(null)}
              className="flex flex-1 items-center justify-center gap-1 rounded bg-gray-700 px-2 py-1 text-sm text-gray-200 hover:bg-gray-600"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Connection hint */}
      {provider === "lm_studio" && !isConnected && (
        <div className="p-3 text-center">
          <p className="text-xs text-gray-500">
            Start LM Studio, load a vision model, then click Test above
          </p>
        </div>
      )}

      {provider === "ollama" && !isConnected && (
        <div className="p-3 text-center">
          <p className="text-xs text-gray-500">
            Start Ollama, pull a vision model (e.g. llava), then click Test above
          </p>
        </div>
      )}

      {provider === "joycaption" && (
        <div className="space-y-2 border-t border-border p-3">
          {joyCaptionInstallStatusData?.installed === true ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2 rounded bg-green-900/40 py-2 text-sm text-green-300">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>JoyCaption is installed and ready.</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    joyCaptionPython &&
                    joyCaptionScript &&
                    diagnoseMutation.mutate({
                      pythonPath: joyCaptionPython,
                      scriptPath: joyCaptionScript,
                    })
                  }
                  disabled={!joyCaptionScript || !joyCaptionPython || diagnoseMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  {diagnoseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => setShowUninstallConfirm(true)}
                  disabled={uninstallJoyCaptionMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded border border-red-900/50 bg-red-900/20 px-3 py-2 text-sm text-red-400 hover:bg-red-900/40 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Uninstall
                </button>
              </div>
            </div>
          ) : installProgress ? (
            <div className="space-y-2 rounded bg-surface/80 p-3">
              <p className="text-sm text-gray-300">{installProgress.message}</p>
              <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full bg-purple-600 transition-all duration-300"
                  style={{ width: `${installProgress.percent}%` }}
                />
              </div>
            </div>
          ) : installJoyCaptionMutation.isPending ? (
            <div className="flex items-center justify-center gap-2 rounded bg-surface/80 py-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Installing...</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => installJoyCaptionMutation.mutate()}
                disabled={installJoyCaptionMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded bg-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Install JoyCaption
              </button>
              {joyCaptionInstallStatusData?.error && !joyCaptionInstallStatusData.installed && (
                <p className="text-xs text-gray-500">
                  {joyCaptionInstallStatusData.error}
                </p>
              )}
              {installJoyCaptionMutation.isError && (
                <p className="text-xs text-red-400">
                  {String(installJoyCaptionMutation.error)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* JoyCaption uninstall confirmation */}
      {showUninstallConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="uninstall-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface-elevated shadow-xl p-4">
            <h2 id="uninstall-title" className="flex items-center gap-2 text-lg font-medium text-gray-100 mb-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              Uninstall JoyCaption?
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              This will remove the JoyCaption venv and script. You can reinstall anytime. The downloaded model cache stays in Hugging Face cache.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowUninstallConfirm(false)}
                className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-gray-300 hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => uninstallJoyCaptionMutation.mutate()}
                disabled={uninstallJoyCaptionMutation.isPending}
                className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
              >
                {uninstallJoyCaptionMutation.isPending ? "Uninstalling…" : "Uninstall"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JoyCaption diagnose result modal */}
      {diagnoseResult !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="diagnose-title"
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2
                id="diagnose-title"
                className="flex items-center gap-2 text-lg font-medium text-gray-100"
              >
                {diagnoseResult.ok ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <X className="h-5 w-5 text-red-400" />
                )}
                JoyCaption Test {diagnoseResult.ok ? "OK" : "Failed"}
              </h2>
              <button
                type="button"
                onClick={() => setDiagnoseResult(null)}
                aria-label="Close"
                className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 text-sm">
              <div className="flex gap-4">
                <span className={diagnoseResult.python_exists ? "text-green-400" : "text-red-400"}>
                  Python: {diagnoseResult.python_exists ? "OK" : "Not found"}
                </span>
                <span className={diagnoseResult.script_exists ? "text-green-400" : "text-red-400"}>
                  Script: {diagnoseResult.script_exists ? "OK" : "Not found"}
                </span>
              </div>
              {diagnoseResult.error && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">Error</p>
                  <pre className="max-h-32 overflow-auto rounded bg-gray-900 p-2 text-red-300 whitespace-pre-wrap break-words text-xs">
                    {diagnoseResult.error}
                  </pre>
                </div>
              )}
              {diagnoseResult.stdout && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">Output</p>
                  <pre className="max-h-32 overflow-auto rounded bg-gray-900 p-2 text-gray-300 whitespace-pre-wrap break-words text-xs">
                    {diagnoseResult.stdout}
                  </pre>
                </div>
              )}
              {diagnoseResult.stderr && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">Stderr</p>
                  <pre className="max-h-32 overflow-auto rounded bg-gray-900 p-2 text-amber-300 whitespace-pre-wrap break-words text-xs">
                    {diagnoseResult.stderr}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
