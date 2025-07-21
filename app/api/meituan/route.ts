import { NextRequest, NextResponse } from "next/server";
import { MeituanAPIService } from "@/lib/meituan-api";
import { isValidIP } from "@/lib/ip-detection";

// POST请求：使用美团API查询IP信息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ip } = body;

    if (!ip) {
      return NextResponse.json({ error: "请提供IP地址" }, { status: 400 });
    }

    // 验证IP格式
    if (!isValidIP(ip)) {
      return NextResponse.json({ error: "无效的IP地址格式" }, { status: 400 });
    }

    // 检查是否适合使用美团API
    if (!MeituanAPIService.isSuitableForMeituan(ip)) {
      return NextResponse.json(
        { error: "该IP不适合使用美团API查询" },
        { status: 400 }
      );
    }

    // 使用美团API查询增强信息
    const result = await MeituanAPIService.enhancedIPQuery(ip);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=600", // 缓存10分钟
      },
    });
  } catch (error) {
    console.error("美团API查询错误:", error);

    // 根据错误类型返回不同的状态码
    if (error instanceof Error && error.message.includes("美团API请求失败")) {
      return NextResponse.json(
        { error: "美团服务暂时不可用，请稍后重试" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "溯源查询失败" },
      { status: 500 }
    );
  }
}
