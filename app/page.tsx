"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { useIPQueryStore } from "@/lib/store";
import IPQueryForm from "@/components/ip-query-form";
import IPInfoCard from "@/components/ip-info-card";
import VersionSwitcher from "@/components/version-switcher";
import ThemeToggle from "@/components/theme-toggle";

export default function Home() {
  const { 
    ipData, 
    isLoading, 
    executeQuery
  } = useIPQueryStore();

  // 页面加载时自动检测客户端IP
  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return (
    <div className="min-h-screen bg-gradient-main transition-colors duration-300">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-32 w-64 h-64 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl transition-colors duration-500"></div>
        <div className="absolute bottom-1/4 -left-32 w-64 h-64 bg-purple-400/20 dark:bg-purple-500/10 rounded-full blur-3xl transition-colors duration-500"></div>
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* 顶部导航区域 */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4"
        >
          <div className="flex-1"></div>
          <VersionSwitcher />
          <div className="flex-1 flex justify-end">
            <ThemeToggle />
          </div>
        </motion.header>

        {/* 主内容区域 - 垂直居中 */}
        <div className="flex-1 flex flex-col justify-center py-8">
          {/* 查询表单 */}
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="px-4 md:px-6 mb-6 md:mb-8"
          >
            <IPQueryForm />
          </motion.section>

          {/* 加载状态 */}
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </motion.div>
                <p className="text-[rgb(var(--color-text-secondary))]">
                  正在查询中...
                </p>
              </motion.div>
            )}

            {/* IP信息展示 - 移除错误状态显示，只使用toast提示 */}
            {ipData && !isLoading && (
              <motion.section
                key="ip-data"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="px-4 md:px-6 w-full"
              >
                <IPInfoCard ipData={ipData} />
              </motion.section>
            )}

            {/* 占位内容（当没有数据且不在加载时） */}
            {!ipData && !isLoading && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center py-8 md:py-12 px-4 md:px-6"
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300"
                >
                  <Search className="w-10 h-10 text-[rgb(var(--color-text-muted))]" />
                </motion.div>
                <p className="text-[rgb(var(--color-text-secondary))] text-center max-w-md">
                  输入IP地址进行查询，或留空查看当前IP信息
                </p>
              </motion.div>
            )}
          </AnimatePresence>


        </div>

        {/* 页脚 */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center py-6 px-6 mt-auto"
        >
          <div className="text-xs text-[rgb(var(--color-text-muted))]">
            <p>© 2025 专注于提供精确的IP地理位置信息</p>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
