import { Config } from "../../config";

const getHeatmapData = async (): Promise<Record<string, number>> => {
  try {
    const response = await fetch(`${Config.TCAPI_URL}/pds/blueskyHeatmap`);
    if (!response.ok) {
      throw new Error(`Failed to fetch heatmap data: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    throw error;
  }
};

const getContributors = async (): Promise<any[]> => {
    try {
        const response = await fetch(`https://api.github.com/repos/${Config.GITHUB_REPO_OWNER}/${Config.GITHUB_REPO_NAME}/contributors`);
        if (!response.ok) {
            throw new Error(`Failed to fetch contributors: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching contributors:", error);
        throw error;
    }
}

export { getHeatmapData, getContributors };