import { IPInfo } from "./store";
import { detectIPVersion } from "./ip-detection";

// 美团API响应接口定义
interface MeituanIPResponse {
  data: {
    lng: number;
    fromwhere: string;
    ip: string;
    rgeo: {
      country: string;
      province: string;
      adcode: string;
      city: string;
      district: string;
    };
    lat: number;
  };
}

interface MeituanLocationResponse {
  data: {
    area: number;
    country: string;
    lng: number;
    cityPinyin: string;
    city: string;
    isForeign: boolean;
    originCityID: number;
    dpCityId: number;
    openCityName: string;
    isOpen: boolean;
    province: string;
    areaName: string;
    parentArea: number;
    district: string;
    id: number;
    detail: string;
    lat: number;
  };
}

export class MeituanAPIService {
  private static readonly IP_API_URL =
    "https://apimobile.meituan.com/locate/v2/ip/loc";
  private static readonly LOCATION_API_URL =
    "https://apimobile.meituan.com/group/v1/city/latlng";

  /**
   * 查询IP地理位置信息
   */
  static async queryIPLocation(ip: string): Promise<IPInfo> {
    try {
      const url = new URL(this.IP_API_URL);
      url.searchParams.set("rgeo", "true");
      url.searchParams.set("ip", ip);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.meituan.com/",
        },
      });

      if (!response.ok) {
        throw new Error(
          `美团API请求失败: ${response.status} ${response.statusText}`
        );
      }

      const result: MeituanIPResponse = await response.json();

      if (!result.data) {
        throw new Error("美团API返回数据格式错误");
      }

      return this.convertToIPInfo(ip, result.data);
    } catch (error) {
      console.error("美团IP查询失败:", error);
      throw new Error(
        `美团IP查询失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  /**
   * 查询坐标对应的详细地址信息
   */
  static async queryLocationDetails(
    lat: number,
    lng: number
  ): Promise<MeituanLocationResponse["data"] | null> {
    try {
      const url = new URL(this.LOCATION_API_URL);
      url.pathname += `/${lat},${lng}`;
      url.searchParams.set("tag", "0");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.meituan.com/",
        },
      });

      if (!response.ok) {
        throw new Error(
          `美团地址查询失败: ${response.status} ${response.statusText}`
        );
      }

      const result: MeituanLocationResponse = await response.json();
      return result.data || null;
    } catch (error) {
      console.error("美团地址查询失败:", error);
      return null;
    }
  }

  /**
   * 增强IP查询结果，添加详细地址信息
   */
  static async enhancedIPQuery(ip: string): Promise<IPInfo> {
    // 先获取IP的基础位置信息
    const ipInfo = await this.queryIPLocation(ip);

    // 然后查询详细地址信息
    const locationDetails = await this.queryLocationDetails(
      ipInfo.location.latitude,
      ipInfo.location.longitude
    );

    if (locationDetails) {
      // 合并详细地址信息
      ipInfo.meituan = {
        areaName: locationDetails.areaName,
        detail: locationDetails.detail,
        cityPinyin: locationDetails.cityPinyin,
        openCityName: locationDetails.openCityName,
        isForeign: locationDetails.isForeign,
        dpCityId: locationDetails.dpCityId,
        area: locationDetails.area,
        parentArea: locationDetails.parentArea,
        fromwhere: ipInfo.meituan?.fromwhere,
        adcode: ipInfo.meituan?.adcode,
      };

      // 更新地理位置精度
      ipInfo.accuracy = "high";
    }

    return ipInfo;
  }

  /**
   * 将美团API数据转换为IPInfo格式
   */
  private static convertToIPInfo(
    ip: string,
    data: MeituanIPResponse["data"]
  ): IPInfo {
    const ipVersion = detectIPVersion(ip);

    return {
      ip,
      country: data.rgeo.country,
      countryCode: data.rgeo.country === "中国" ? "CN" : "XX",
      province: data.rgeo.province,
      city: data.rgeo.city,
      district: data.rgeo.district,
      location: {
        latitude: data.lat,
        longitude: data.lng,
      },
      accuracy: "medium",
      source: "MeiTuan",
      ipVersion: ipVersion as "IPv4" | "IPv6",
      meituan: {
        fromwhere: data.fromwhere,
        adcode: data.rgeo.adcode,
      },
    };
  }

  /**
   * 检查IP是否适合使用美团API查询
   */
  static isSuitableForMeituan(ip: string): boolean {
    // 美团API主要针对中国地区，可以添加更多检查逻辑
    return detectIPVersion(ip) !== "invalid";
  }
}
