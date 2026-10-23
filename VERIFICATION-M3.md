# M3 verification — 2026-10-23

## Phạm vi và môi trường

M3: tuyến point-to-point, checkpoint, xếp hạng, thời gian về đích, timeout, unstuck, HUD và rematch. Không M4/M5.
Windows, bundled Node 24.22.1/npm 11.19.0, Chrome và Edge cài sẵn. Dependency giữ nguyên bản pin của M2 (Three.js 0.186.1, Colyseus core 0.18.23/SDK 0.18.6, Vite 8.3.5); package 0.3.0.
Các lệnh npm dùng bundled Node gọi npm-cli.js trực tiếp theo README. Không sửa security/firewall cho M3.

## Các kiểm tra đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| npm run check | Passed: strict TypeScript, ESLint zero warning, 40 unit/integration tests, production build |
| TEST_PRODUCTION=1 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e | 6 passed / khoảng 1,3 phút; gồm regression M1/M2 và flow M3 |
| npm run test:race | Passed: hai socket thật, đủ tuyến production, results giống nhau, guest không được rematch, host rematch cùng mã, vòng 2 qua CP đầu |
| npm run test:load | Passed 7 profile: 2/4/8/16 guest; 2 guest RTT 50/100/150 ms, jitter 20 ms |
| Frontend/backend local | Frontend 5173 và health 2567 hoạt động; server báo M3 |
| Visual QA | Đã xem ảnh kết quả và vòng hai, bảng/controls hiển thị đầy đủ |

Không cài lại dependency cho M3 vì không thêm/đổi dependency; clean install M2 trước đó có trong VERIFICATION-M2.md. Còn cảnh báo build chunk >500 kB và NO_COLOR/FORCE_COLOR của test runner, không làm thất bại kiểm tra.

## Bao phủ tiêu chí

- 3400 m, 8 section, 3 làn; thẳng xuất phát, cua nhẹ, công trường có barrier/cone, canyon và thẳng cuối. Finish ở 3350 m, 50 m runoff.
- Không cho bỏ cổng: teleport/quá tốc độ bước, off-road, lùi, history sau cổng bị bỏ không tạo checkpoint/finish. Gói tin thêm position bị từ chối. Client chỉ gửi ý định.
- Thứ tự server: checkpoint rồi progress; finish theo thời điểm cắt vạch nội suy. Test hai người cắt cùng tick đảo thứ tự Map xác nhận người cắt trước thắng. Mọi client nhận cùng bảng.
- Sau người đầu: cửa sổ 45 giây. Hết hạn nhận DNF, kết quả đóng băng; không cộng finish sau hạn. Không ai về thì hard timeout 5 phút.
- R: chỉ racing/chưa finish/đúng round/xe chậm; lùi về điểm an toàn, giữ fuel/recharge và CP; cooldown chống spam. Interpolation không kéo xuyên cảnh qua reset.
- Rematch chỉ host khi results. Giữ phòng, tăng roundId, xóa Ready/finish/progress/cooldown, đầy fuel; input vòng cũ không có hiệu lực. Người disconnect giữ DNF/kết quả, host chuyển quyền.
- Browser M3 thật dùng short fixture server riêng để test reset/cooldown, checkpoint, bảng kết quả khớp SDK, host trở lobby, Ready và Start vòng hai. Fixture chỉ trong test, production không có client option chọn cổng ngắn.
- Hai socket toàn tuyến dùng luật production: 9 CP, cùng kết quả, thời gian 78,175 s và 78,189 s; round 2 cùng room và qua CP đầu. Đây là driver tự động (không gameplay bot), chưa phải human playtest 2–3 phút.
- Chrome + Edge tiếp tục thấy xe nhau, keyboard/blur/Esc, lỗi mạng, host transfer; solo regression và 16-member rendering đều pass.

## Đo tải local

Backend riêng, cùng máy; baseline ~10 giây/profile, latency ~8 giây/profile. Snapshot Hz đếm message thật; bandwidth là payload WebSocket nhị phân tổng (không HTTP/TCP/TLS/frame overhead). CPU process.cpuUsage: % một logical core, cửa sổ ngắn trên Windows có thể bằng 0 do độ phân giải.

| Guest | RTT danh nghĩa / jitter ms | Tick Hz | Snapshot Hz | p95 tick ms | CPU % | Down kB/s | Up kB/s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 0 / 0 | 29,97 | 15,03 | 0,098 | 1,87 | 28,1 | 2,5 |
| 4 | 0 / 0 | 30,06 | 14,93 | 0,086 | 1,25 | 97,1 | 5,1 |
| 8 | 0 / 0 | 30,01 | 15,03 | 0,102 | 0,47 | 361,7 | 10,0 |
| 16 | 0 / 0 | 30,03 | 15,02 | 0,163 | 0,93 | 1391,2 | 19,9 |
| 2 | 50 / 20 | 30,15 | 15,11 | 0,048 | 0 | 28,2 | 2,5 |
| 2 | 100 / 20 | 30,02 | 14,90 | 0,046 | 0 | 27,9 | 2,5 |
| 2 | 150 / 20 | 30,12 | 15,03 | 0,076 | 0 | 28,0 | 2,5 |

Tất cả profile canonical positions khớp ở cùng tick, không unexpected room errors. RTT median đo được 63/111/170 ms với các proxy profile. Đây là kiểm tra snapshot/movement, không phải full-race latency hoặc WAN playtest. Chi tiết: verification/m3-load.json.

## Render và giới hạn

Một trình duyệt headless software WebGL + 15 SDK guest: 13,31 FPS trung bình, 199 draw calls. Đã lưu verification/m3-render.json và verification/m3/16-riders.png. Không được suy diễn thành hiệu năng GPU hoặc 16 máy vật lý. Full snapshots M3 dùng băng thông cao hơn M2; cần delta/snapshot tối ưu trước public scale.

Chưa có prediction, reconnect, combat, HP, xe-va-xe, skills/characters, deployment. Tuning 2–3 phút chưa xác nhận bằng người chơi; automated no-Nitro ~78 giây. Backend/frontend người dùng giữ chạy, test fixture/proxy tự dọn.

## Artifact

- README.md: setup local, Windows runtime, Wi-Fi/LAN, controls và lệnh test.
- DECISIONS.md: lựa chọn M3 và tradeoff.
- verification/m3-race.json, m3-load.json, m3-render.json: dữ liệu thật.
- verification/m3/: ảnh kết quả, vòng hai và 16 rider.
- ../road-riot-m3.zip: source, lockfile, dist, docs và verification; không node_modules.

Final QA: repeated M3 browser flow after the last HUD labels (1 passed / 24.9 s); rebuilt after correcting checkpoint sign face placement. Captured and inspected verification/m3/checkpoint-approach.png on the production course through the dev preview. Final lint/typecheck passed. Localhost and current Wi-Fi frontend address both HTTP 200; backend stderr empty. This Wi-Fi-address check is on the host itself, not a new second-device playtest.
