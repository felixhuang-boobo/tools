#!/usr/bin/env python3
"""
商家闭店脚本：库存清零 + 下架 + 移入回收站
通过 sellerportal 接口操作，走服务层保证缓存一致性

流程：Step1 库存清零 → Step2 下架 → Step3 移入回收站

前置条件：
  - CSV 文件格式：item_number,available_qty
  - 需要对应商家的登录 token（从浏览器 Seller Portal F12 获取）

使用方式：
  python3 close_store.py --seller-id 502 --token <token> --edit-user <email> --csv <file.csv>

参数说明：
  --seller-id   商家ID
  --token       Seller Portal 登录 token（从浏览器开发者工具获取）
  --edit-user   操作人标识，如 name@yamibuy.com(12345)
  --csv         商品库存 CSV 文件路径（默认 inventory.csv）
  --site-code   站点代码（默认 us）
  --batch-size  每批处理数量（默认 50）
  --base-url    API 基础地址（默认 https://centralapi.yamibuy.net）
"""
import argparse
import csv
import json
import requests
import time
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="商家闭店脚本：库存清零 + 下架 + 移入回收站")
    parser.add_argument("--seller-id", type=int, required=True, help="商家ID")
    parser.add_argument("--token", type=str, required=True, help="Seller Portal 登录 token")
    parser.add_argument("--edit-user", type=str, required=True, help="操作人标识")
    parser.add_argument("--csv", type=str, default="inventory.csv", help="商品库存 CSV 文件路径")
    parser.add_argument("--site-code", type=str, default="us", help="站点代码")
    parser.add_argument("--batch-size", type=int, default=50, help="每批处理数量")
    parser.add_argument("--base-url", type=str, default="https://centralapi.yamibuy.net", help="API 基础地址")
    return parser.parse_args()


def make_headers(token, seller_id, site_code):
    return {
        "Content-Type": "application/json",
        "token": token,
        "seller_id": str(seller_id),
        "site_code": site_code
    }


def read_item_numbers(csv_file):
    items = []
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            items.append(row['item_number'].strip())
    return items


def clear_inventory(base_url, headers, csv_file, batch_size):
    """Step 1: 通过 batchupdateNew 接口批量清零库存"""
    items = []
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            qty = int(row['available_qty'])
            if qty > 0:
                items.append({
                    "item_number": row['item_number'].strip(),
                    "goods_number": -qty,
                    "row_index": len(items) + 1
                })

    print(f"共 {len(items)} 个商品需要清零库存")

    success = 0
    fail = 0
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(items) + batch_size - 1) // batch_size

        try:
            resp = requests.post(
                f"{base_url}/sellerportal/inventory/batchupdateNew",
                headers=headers,
                json=batch,
                timeout=30
            )
            data = resp.json()
            if data.get('messageId') == '10000':
                success += len(batch)
                print(f"  批次 {batch_num}/{total_batches}: 成功 ({len(batch)}个)")
            else:
                fail += len(batch)
                print(f"  批次 {batch_num}/{total_batches}: 失败 - {data.get('messageId')} {data.get('zhError', '')}")
        except Exception as e:
            fail += len(batch)
            print(f"  批次 {batch_num}/{total_batches}: 异常 - {e}")

        time.sleep(0.5)

    print(f"\n库存清零完成: 成功 {success}, 失败 {fail}")
    return fail == 0


def deactivate_items(base_url, headers, csv_file, batch_size):
    """Step 2: 通过 batchUpdateStatus 接口批量下架商品 (status=D)"""
    items = read_item_numbers(csv_file)
    print(f"共 {len(items)} 个商品需要下架")

    success = 0
    fail = 0
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(items) + batch_size - 1) // batch_size

        payload = json.dumps({
            "itemList": json.dumps(batch),
            "status": "D"
        })

        try:
            resp = requests.post(
                f"{base_url}/sellerportal/selleritem/batchUpdateStatus",
                headers=headers,
                data=payload,
                timeout=30
            )
            data = resp.json()
            if data.get('messageId') == '10000':
                success += len(batch)
                print(f"  批次 {batch_num}/{total_batches}: 成功 ({len(batch)}个)")
            else:
                fail += len(batch)
                print(f"  批次 {batch_num}/{total_batches}: 失败 - {data.get('messageId')} {data.get('zhError', '')}")
        except Exception as e:
            fail += len(batch)
            print(f"  批次 {batch_num}/{total_batches}: 异常 - {e}")

        time.sleep(0.5)

    print(f"\n下架完成: 成功 {success}, 失败 {fail}")
    return fail == 0


def recycle_items(base_url, headers, csv_file, batch_size, edit_user):
    """Step 3: 通过 batchDelete 接口批量移入回收站（需先下架+库存为0）"""
    items = read_item_numbers(csv_file)
    print(f"共 {len(items)} 个商品需要移入回收站")

    success = 0
    fail = 0
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(items) + batch_size - 1) // batch_size

        try:
            resp = requests.post(
                f"{base_url}/sellerportal/im/item/status/batchDelete",
                headers=headers,
                json={"itemNumberList": batch, "edit_user": edit_user},
                timeout=30
            )
            data = resp.json()
            if data.get('messageId') == '10000':
                success += len(batch)
                print(f"  批次 {batch_num}/{total_batches}: 成功 ({len(batch)}个)")
            else:
                fail += len(batch)
                body = data.get('body', [])
                if isinstance(body, list):
                    for item in body:
                        if item.get('errorID') != '10000':
                            print(f"    {item.get('item_number')}: {item.get('zhError', '')}")
                print(f"  批次 {batch_num}/{total_batches}: 失败 - {data.get('messageId')} {data.get('zhError', '')}")
        except Exception as e:
            fail += len(batch)
            print(f"  批次 {batch_num}/{total_batches}: 异常 - {e}")

        time.sleep(0.5)

    print(f"\n回收完成: 成功 {success}, 失败 {fail}")
    return fail == 0


if __name__ == "__main__":
    args = parse_args()
    headers = make_headers(args.token, args.seller_id, args.site_code)

    print("=" * 50)
    print(f"商家 {args.seller_id} 闭店操作")
    print("=" * 50)

    print("\n📦 Step 1: 库存清零...")
    inventory_ok = clear_inventory(args.base_url, headers, args.csv, args.batch_size)

    if not inventory_ok:
        confirm = input("\n⚠️ 库存清零有失败项，是否继续？(y/N): ")
        if confirm.lower() != 'y':
            sys.exit(1)

    print("\n⬇️ Step 2: 商品下架...")
    deactivate_ok = deactivate_items(args.base_url, headers, args.csv, args.batch_size)

    if not deactivate_ok:
        confirm = input("\n⚠️ 下架有失败项，是否继续？(y/N): ")
        if confirm.lower() != 'y':
            sys.exit(1)

    print("\n🗑️ Step 3: 移入回收站...")
    recycle_items(args.base_url, headers, args.csv, args.batch_size, args.edit_user)

    print("\n✅ 闭店操作完成")
