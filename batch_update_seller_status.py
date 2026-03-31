"""
批量调用 updateSellerStatus 接口

用法:
  python batch_update_seller_status.py 3177094371 3177094372 3177094373
  python batch_update_seller_status.py -f item_numbers.txt
  python batch_update_seller_status.py -f item_numbers.txt --token "新token"

配置:
  在同目录下创建 .env 文件，写入 SP_TOKEN=xxx（参考 .env.example）
"""

import argparse
import json
import os
import time
import requests


BASE_URL = "https://centralapi.yamibuy.net/sp/seller/v1/itemApproval/updateSellerStatus"


def load_token_from_env():
    """从同目录 .env 文件加载 SP_TOKEN"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        return None
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("SP_TOKEN=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip()
    return None


DEFAULT_TOKEN = load_token_from_env() or ""


def call_api(item_number: str, token: str, seller_status: str, memo: str, audit_reason: int, user: str):
    headers = {"token": token, "Content-Type": "application/json"}
    payload = {
        "item_number": item_number,
        "seller_status": seller_status,
        "memo": memo,
        "audit_reason": audit_reason,
        "user": user,
    }
    resp = requests.post(BASE_URL, headers=headers, json=payload, timeout=10)
    return resp.status_code, resp.json()


def main():
    parser = argparse.ArgumentParser(description="批量调用 updateSellerStatus")
    parser.add_argument("items", nargs="*", help="item_number 列表")
    parser.add_argument("-f", "--file", help="从文件读取 item_number（每行一个）")
    parser.add_argument("--token", default=DEFAULT_TOKEN)
    parser.add_argument("--seller-status", default="A")
    parser.add_argument("--memo", default="价格审核积压转人工")
    parser.add_argument("--audit-reason", type=int, default=2)
    parser.add_argument("--user", default="system")
    parser.add_argument("--delay", type=float, default=0.2, help="请求间隔秒数，默认0.2")
    args = parser.parse_args()

    if not args.token:
        print("错误: 未配置 token，请在 .env 文件中设置 SP_TOKEN 或通过 --token 参数传入")
        return

    item_numbers = list(args.items)
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            item_numbers.extend(line.strip() for line in f if line.strip())

    if not item_numbers:
        parser.print_help()
        return

    total, success, fail = len(item_numbers), 0, 0
    print(f"开始批量处理，共 {total} 个 item_number\n")

    for item in item_numbers:
        try:
            status_code, data = call_api(item, args.token, args.seller_status, args.memo, args.audit_reason, args.user)
            if status_code == 200 and data.get("code") == 200:
                success += 1
                print(f"[OK]   {item} -> {json.dumps(data, ensure_ascii=False)}")
            else:
                fail += 1
                print(f"[FAIL] {item} -> HTTP {status_code} {json.dumps(data, ensure_ascii=False)}")
        except Exception as e:
            fail += 1
            print(f"[ERR]  {item} -> {e}")

        if args.delay > 0:
            time.sleep(args.delay)

    print(f"\n处理完成: 总计={total} 成功={success} 失败={fail}")


if __name__ == "__main__":
    main()
