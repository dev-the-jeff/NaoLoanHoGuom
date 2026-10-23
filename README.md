# ROAD RIOT — M3 / Canyon Run

Three.js + TypeScript + Vite; Node.js + Colyseus. M3 có đường point-to-point 3,4 km, 9 cổng tuần tự, xếp hạng/thời gian về đích do server xác nhận, reset an toàn, bảng kết quả và chơi lại cùng phòng. Giữ tập solo và đường 3 làn của M1/M2. Chưa triển khai M4/M5.

## Chạy local

Yêu cầu Node.js >=22.12, npm, Chrome/Edge desktop có WebGL 2. Từ thư mục dự án:

~~~sh
npm ci
npm run dev
~~~

Mở **http://127.0.0.1:5173**. Backend health: **http://127.0.0.1:2567/health**. Ctrl+C dừng hai dịch vụ. Nếu preview đã chạy thì dùng phiên bản đó, tránh chạy thêm trên cùng cổng.

- **LET’S RIDE:** tập solo, không cần backend, không ghi kết quả thi đấu.
- **MULTIPLAYER / ONLINE:** nickname, tạo phòng, chia sẻ mã 6 ký tự. Người khác nhập mã để vào.
- Tất cả bấm **READY**, host bấm **HOST · START** khi có ít nhất 2 người.
- Qua từng cổng xanh; cổng cam **FINISH** ở mốc 3350 m. 50 m cuối là khoảng dừng.
- HUD: vị trí, CP, tiến độ, đồng hồ. Người về đầu mở cửa sổ 45 giây. Hết hạn, người chưa về nhận DNF, xếp theo checkpoint rồi tiến độ. Nếu chưa ai về, đua kết thúc sau 5 phút.
- Phanh dưới 15 km/h, bấm **R** để lùi về trước checkpoint đã hoàn thành gần nhất. Cooldown 8 giây, không cộng Nitro, không bỏ checkpoint. Trước CP đầu, về vị trí xuất phát.
- Bảng kết quả: host chọn **HOST · BACK TO LOBBY**, mọi người Ready lại và Start. Giữ mã phòng. Hoặc **LEAVE ROOM**.
- Host thoát thì chuyển quyền; người ngắt kết nối giữ kết quả đã về đích hoặc DNF. Chưa có tự reconnect/late join.
### This Windows machine — use the Codex runtime

Controlled Folder Access blocks the system Node executable from modifying Documents on this machine. Use the runtime already allowed during this session. **Call npm’s CLI with this executable**, because npm.cmd can choose the system Node even when PATH is changed:

```powershell
cd 'C:\Users\HB HOC VIEN 2\Documents\Codex\2026-10-23\read-road-riot-gdd-codex-md\outputs\road-riot'
$taskNode = 'C:\Users\HB HOC VIEN 2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$taskNpm = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
$env:PATH = (Split-Path $taskNode) + ';' + $env:PATH
& $taskNode $taskNpm ci
& $taskNode $taskNpm run dev
```

Use the same `& $taskNode $taskNpm ...` prefix for other npm commands below on this machine. No global PATH or security change is required. On another machine use its regular installed Node/npm. Stop running frontend/backend processes before doing a clean reinstall if Windows holds native binary files open.

## Cùng Wi-Fi / LAN

1. Host chạy hai dịch vụ bằng lệnh trên. Cùng Wi-Fi dùng được, không bắt buộc dây mạng.
2. Máy khác mở **http://HOST_LAN_IP:5173**, không dùng localhost. Wi-Fi host trong lần kiểm tra này: **192.168.0.32**, tức **http://192.168.0.32:5173**; IP có thể đổi.
3. Frontend tự kết nối backend hostname đó, cổng **2567**. Vào cùng mã, Ready, Start.
4. Nếu firewall hoặc Wi-Fi guest/client isolation chặn, chủ máy/mạng cần cho phép hai cổng. M3 không sửa firewall.

PORT/HOST cấu hình backend (2567/0.0.0.0); CLIENT_PORT đổi cổng Vite (5173).
Backend khác địa chỉ: đặt VITE_SERVER_URL=ws://HOST:PORT trong client/.env.local rồi restart Vite/rebuild. HTTPS cần WSS. GitHub Pages không chạy được backend Node. Chưa public hosting.

## Điều khiển

| Phím | Tác dụng |
| --- | --- |
| W / ↑ | Tăng ga |
| S / ↓ | Phanh, không có số lùi |
| A / ←, D / → | Lái |
| Shift + ga | Nitro |
| R | Solo: bắt đầu lại. Online: reset an toàn khi chậm |
| Esc | Solo: dừng. Online: phanh xe bạn, cuộc đua tiếp tục |
| F3 | FPS, draw calls, vị trí, ping, tick/snapshot, phòng |

Cap 160 km/h, Nitro 190 km/h; bình đầy dùng 3 giây, chờ 2 giây rồi hồi 15%/giây. Giữ cảm giác tốc độ/cảnh ven đường đã làm. Đường gồm xuất phát, cua nhẹ, công trường có vật cản báo trước, cua canyon và đoạn thẳng về đích.

## Kiểm tra

~~~sh
npm run check        # TypeScript, ESLint, unit + socket integration, production build
npm run test:e2e     # 6 kịch bản trình duyệt
npm run test:race    # hai socket chạy toàn tuyến production rồi rematch; khoảng 95 giây
npm run test:load    # 7 profile 2/4/8/16 kết nối + RTT/jitter; khoảng 90 giây
npm run build
npm run preview     # frontend production 4173, backend chạy riêng
npm run start:server
~~~

Mặc định Playwright dùng Chromium (npx playwright install chromium nếu chưa có); bài hai trình duyệt cần Edge. Máy này dùng Chrome/Edge cài sẵn:

~~~powershell
$env:TEST_PRODUCTION = '1'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
& $taskNode $taskNpm run build
& $taskNode $taskNpm run test:e2e
Remove-Item Env:TEST_PRODUCTION
Remove-Item Env:PLAYWRIGHT_CHANNEL
~~~

Playwright dùng lại backend 2567 và frontend 4173/5173 nếu đang chạy. Bài M3 mở server fixture 2571 + Vite 5180 để test vòng ngắn, tự dọn; fixture chỉ ở mã test, matchmaking không được chọn luật ngắn. Bài test:race dùng luật production và cổng ngẫu nhiên để chạy đủ tuyến thật, ghi verification/m3-race.json.

Bài test:load tạo backend 2568 (TEST_SERVER_PORT để đổi); tự dọn khách/backend/proxy. LOAD_SECONDS đổi thời lượng từng profile. Kết quả verification/m3-load.json. Phòng trong RAM; restart backend xóa phòng.

## Kiến trúc và lifecycle

~~~text
Keyboard -> input {roundId, seq, throttle, brake, steer, nitro}
                    | 30 Hz / Colyseus
                    v
RaceRoom -> RaceSimulation -> shared BikeController (120 Hz substeps)
                    |             |
                    +---- Checkpoints: sequential gates / safe reset
                    |
             rank / finish / timeout / results / rematch
                    | 15 Hz snapshot
                    v
MultiplayerClient -> SnapshotBuffer -> BikeView / RemoteBikes / RaceHud
~~~

- shared/src/course.ts: section, vật cản và luật tập trung; hình ảnh/server cùng hình học.
- shared/src/Road.ts, BikeController.ts: mô phỏng thuần, không phụ thuộc Three.js.
- server/src/simulation/Checkpoints.ts: interface trước implementation, kiểm tra chuyển động/cổng tuần tự/điểm an toàn.
- RaceSimulation.ts: xếp hạng checkpoint/tiến độ, thời điểm cắt vạch nội suy trong substep; tie-break grid cố định.
- RaceRoom.ts: phòng, quyền host, giới hạn payload/rate, lệnh reset/rematch có roundId. Không nhận vị trí/checkpoint/thời gian kết thúc từ client.
- client/src/network: nội suy 100 ms, chưa prediction; reset snap theo resetVersion, rematch xóa lịch sử vòng cũ.
- RaceHud: textContent an toàn; chỉ tạo hàng kết quả khi kết thúc. AbortController dọn event.
- Props dùng InstancedMesh, xe remote dùng pool; không spawn object trong physics. Geometry/material/texture có owner và dispose. Không thêm Unity/Odin/DOTween hay physics engine.
- Rule injection chỉ dành server construction/test; không có tùy chọn rút ngắn đường trong production.

## Kết quả và giới hạn

Xem **VERIFICATION-M3.md**. Hoàn thành tiêu chí M3; chưa bắt đầu M4.

- Hai socket production qua đủ 9 cổng, kết quả giống nhau, qua CP đầu vòng hai. Driver tự động mất khoảng **78 giây**; mục tiêu GDD 2–3 phút chưa được xác nhận bằng người chơi. Giữ cap tốc độ người dùng đã chấp nhận.
- 16 kết nối tổng hợp đạt ~30 tick/s, ~15 snapshot/s. M3 snapshot đầy đủ tốn khoảng 1,39 MB/s tổng downstream ở 16 người; chưa tối ưu delta/băng thông WAN.
- Một trình duyệt software WebGL + 15 SDK guest: **13,3 FPS**, 199 draw calls. Không phải benchmark GPU thực/16 thiết bị, chưa tuyên bố 60 FPS.
- Chưa reconnect, prediction, va chạm xe-với-xe, combat, HP, nhân vật/kỹ năng, tài khoản/database.
- Build còn cảnh báo bundle >500 kB. Test tải ngắn trên một máy không thay playtest dài/WAN thực.

Báo cáo M1/M2 giữ làm lịch sử và mô tả phiên bản lúc đó.
## Nội dung Git

Repository chỉ lưu source, test/tooling, cấu hình, lockfile, tài liệu và thông báo bản quyền thư viện. Không version node_modules, dist, ZIP, file .env hoặc dữ liệu/ảnh kiểm thử sinh tự động. Hai thư mục verification và verification/m3 có .gitkeep để các lệnh kiểm tra ghi kết quả trên bản clone sạch. Chạy lại các lệnh test để sinh báo cáo/ảnh.
