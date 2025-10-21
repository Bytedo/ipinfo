import * as fs from "fs";
import * as path from "path";
import { GeoIPError } from "./types";

// 数据库配置
const DB_CONFIG = {
  "GeoLite2-City.mmdb": {
    url: "https://gh-proxy.com/https://github.com/P3TERX/GeoLite.mmdb/releases/download/2025.10.19/GeoLite2-City.mmdb",
    expectedSize: 58 * 1024 * 1024, // 约58MB
  },
  "GeoLite2-ASN.mmdb": {
    url: "https://gh-proxy.com/https://github.com/P3TERX/GeoLite.mmdb/releases/download/2025.10.19/GeoLite2-ASN.mmdb",
    expectedSize: 10 * 1024 * 1024, // 约10MB
  },
  "GeoCN.mmdb": {
    url: "https://gh-proxy.com/github.com/ljxi/GeoCN/releases/download/Latest/GeoCN.mmdb",
    expectedSize: 7.5 * 1024 * 1024, // 约7.5MB
  },
};

// 数据库状态接口
export interface DatabaseStatus {
  name: string;
  exists: boolean;
  size: number;
  lastModified: Date | null;
  isValid: boolean;
  expectedSize?: number;
}

// 下载进度接口
export interface DownloadProgress {
  filename: string;
  downloaded: number;
  total: number;
  percentage: number;
  status: "idle" | "downloading" | "completed" | "error";
  error?: string;
}

// 下载事件类型
export type DownloadEvent =
  | { type: "start"; filename: string }
  | { type: "progress"; progress: DownloadProgress }
  | { type: "complete"; filename: string }
  | { type: "error"; filename: string; error: string };

// 事件监听器类型
export type DownloadEventListener = (event: DownloadEvent) => void;

/**
 * 数据库下载管理器
 * 负责MMDB数据库文件的检测、下载、验证和管理
 */
export class DatabaseDownloader {
  private downloadProgress: Map<string, DownloadProgress> = new Map();
  private eventListeners: DownloadEventListener[] = [];
  private isDownloading = false;
  private readonly dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), "lib", "data");
    this.ensureDataDirectory();
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: DownloadEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: DownloadEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(event: DownloadEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  /**
   * 检查所有数据库文件状态
   */
  async checkDatabases(): Promise<DatabaseStatus[]> {
    const statuses: DatabaseStatus[] = [];

    for (const [filename, config] of Object.entries(DB_CONFIG)) {
      const filepath = path.join(this.dbPath, filename);
      const exists = fs.existsSync(filepath);

      let size = 0;
      let lastModified: Date | null = null;
      let isValid = false;

      if (exists) {
        try {
          const stats = fs.statSync(filepath);
          size = stats.size;
          lastModified = stats.mtime;
          isValid = this.validateFile(filepath, config.expectedSize);
        } catch (error) {
          console.warn(`检查文件 ${filename} 时出错:`, error);
        }
      }

      statuses.push({
        name: filename,
        exists,
        size,
        lastModified,
        isValid,
        expectedSize: config.expectedSize,
      });
    }

    return statuses;
  }

  /**
   * 验证文件完整性
   */
  private validateFile(filepath: string, expectedSize?: number): boolean {
    try {
      const stats = fs.statSync(filepath);

      // 检查文件大小
      if (expectedSize && stats.size < expectedSize * 0.9) {
        console.warn(
          `文件 ${filepath} 大小异常: ${stats.size} < ${expectedSize * 0.9}`
        );
        return false;
      }

      // 检查文件是否可读
      const fd = fs.openSync(filepath, "r");
      fs.closeSync(fd);

      return true;
    } catch (error) {
      console.warn(`验证文件 ${filepath} 时出错:`, error);
      return false;
    }
  }

  /**
   * 下载单个数据库文件
   */
  async downloadDatabase(filename: string): Promise<void> {
    const config = DB_CONFIG[filename as keyof typeof DB_CONFIG];
    if (!config) {
      throw new GeoIPError(`未知的数据库文件: ${filename}`, "INVALID_DATABASE");
    }

    const filepath = path.join(this.dbPath, filename);

    // 初始化下载进度
    const progress: DownloadProgress = {
      filename,
      downloaded: 0,
      total: config.expectedSize || 0,
      percentage: 0,
      status: "downloading",
    };

    this.downloadProgress.set(filename, progress);
    this.emitEvent({ type: "start", filename });

    try {
      this.isDownloading = true;

      // 使用fetch下载文件
      const response = await fetch(config.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength
        ? parseInt(contentLength, 10)
        : config.expectedSize || 0;

      if (!response.body) {
        throw new Error("响应体为空");
      }

      // 创建写入流
      const writeStream = fs.createWriteStream(filepath);
      const reader = response.body.getReader();

      let downloaded = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        writeStream.write(value);
        downloaded += value.length;

        // 更新进度
        progress.downloaded = downloaded;
        progress.total = total;
        progress.percentage =
          total > 0 ? Math.round((downloaded / total) * 100) : 0;

        this.emitEvent({ type: "progress", progress: { ...progress } });
      }

      writeStream.end();

      // 等待写入完成
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // 验证下载的文件
      if (!this.validateFile(filepath, config.expectedSize)) {
        throw new Error("下载的文件验证失败");
      }

      // 更新状态为完成
      progress.status = "completed";
      progress.percentage = 100;
      this.emitEvent({ type: "complete", filename });
    } catch (error) {
      // 清理部分下载的文件
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      const errorMessage = error instanceof Error ? error.message : "未知错误";
      progress.status = "error";
      progress.error = errorMessage;

      this.emitEvent({ type: "error", filename, error: errorMessage });

      throw new GeoIPError(
        `下载数据库 ${filename} 失败: ${errorMessage}`,
        "DOWNLOAD_FAILED"
      );
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * 下载所有缺失的数据库文件
   */
  async downloadMissingDatabases(): Promise<void> {
    const statuses = await this.checkDatabases();
    const missingDatabases = statuses.filter(
      (status) => !status.exists || !status.isValid
    );

    if (missingDatabases.length === 0) {
      console.log("所有数据库文件都已存在且有效");
      return;
    }

    console.log(`需要下载 ${missingDatabases.length} 个数据库文件`);

    // 并发下载所有缺失的数据库
    const downloadPromises = missingDatabases.map((status) =>
      this.downloadDatabase(status.name)
    );

    await Promise.allSettled(downloadPromises);

    // 检查是否所有下载都成功
    const finalStatuses = await this.checkDatabases();
    const stillMissing = finalStatuses.filter(
      (status) => !status.exists || !status.isValid
    );

    if (stillMissing.length > 0) {
      throw new GeoIPError(
        `部分数据库下载失败: ${stillMissing.map((s) => s.name).join(", ")}`,
        "DOWNLOAD_FAILED"
      );
    }
  }

  /**
   * 获取下载进度
   */
  getDownloadProgress(): DownloadProgress[] {
    return Array.from(this.downloadProgress.values());
  }

  /**
   * 获取特定文件的下载进度
   */
  getFileProgress(filename: string): DownloadProgress | null {
    return this.downloadProgress.get(filename) || null;
  }

  /**
   * 检查是否正在下载
   */
  isCurrentlyDownloading(): boolean {
    return this.isDownloading;
  }

  /**
   * 清理下载进度
   */
  clearProgress(): void {
    this.downloadProgress.clear();
  }
}

// 全局下载管理器实例
export const databaseDownloader = new DatabaseDownloader();
