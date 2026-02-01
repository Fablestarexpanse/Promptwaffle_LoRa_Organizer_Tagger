import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { loadProject } from "@/lib/tauri";

export function useProjectImages() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const setIsLoadingProject = useProjectStore((s) => s.setIsLoadingProject);

  const query = useQuery({
    queryKey: ["project", "images", rootPath],
    queryFn: () => loadProject(rootPath!),
    enabled: !!rootPath,
  });

  // Turn off loading overlay when query settles (success or error)
  useEffect(() => {
    if (query.isSuccess || query.isError) {
      setIsLoadingProject(false);
    }
  }, [query.isSuccess, query.isError, setIsLoadingProject]);

  return query;
}
