# รัฐนาวา — ผลตรวจชุดเทคโนโลยีกับเอกสารปัจจุบัน

ตรวจ 22 พ.ย. 2569 ตาม kickoff หัวข้อ 4 ข้อ 2 · ตัวที่เลือกอยู่ใน `PRODUCT.md` หัวข้อ Stack · ผู้ตรวจคือ agent 3 ตัว (เครื่องมือสร้าง แพลตฟอร์ม และหน้าจอ) ซึ่งไม่ได้เป็นผู้เขียนเอกสารนี้

**วิธีตรวจ:** ดูรุ่นและวันออกจาก npm registry (`npm view`) · อ่านเอกสารจากซอร์สบน GitHub ที่ตรงกับ tag ของรุ่น เพราะเครือข่ายของเซสชันเปิดเว็บเอกสารเหล่านี้ไม่ได้: vite.dev, vitest.dev, typescriptlang.org, developer.mozilla.org, webkit.org, preactjs.com, creativecommons.org · ลองติดตั้งชุดที่เลือกรวมกันในพื้นที่ชั่วคราว แล้วรัน tsc, vitest และ vite build ผ่านทั้งหมด

| เรื่อง | v2 เสนอ | ผลตรวจ | สถานะ | แหล่ง |
|---|---|---|---|---|
| ภาษา | TypeScript | 7.0.2 เป็นตัวคอมไพเลอร์แบบ native (Go) ตรวจชนิดได้เท่า 6.0 แต่ API สำหรับเครื่องมืออื่นยังไม่พร้อม typescript-eslint ใช้กับ 7 ไม่ได้ → ใช้ 7.0.2 ตรวจชนิดอย่างเดียว · lint ใช้ oxlint | ใช้ได้ มีเงื่อนไข | github.com/microsoft/typescript-go README · npm typescript, typescript-eslint |
| build | (ไม่ระบุ) | Vite 8.3.8 ใช้ build แบบ static ได้ ตั้ง base เป็น `/<ชื่อ repo>/` สำหรับ GitHub Pages | ใช้ได้ | vitejs/vite v8.3.8 docs/guide/static-deploy.md |
| เทสต์ | unit · property-based · golden runs | Vitest 5.1.1 (environment node) · fast-check 4.11.0 · snapshot ที่ commit ไว้ไม่ถูกเขียนใหม่เมื่อ CI=true | ใช้ได้ | vitest-dev/vitest v5.1.1 docs · npm fast-check |
| seeded RNG | ใช้ seeded RNG | เขียนเองใน repo (sfc32 หรือ xoshiro128**) ราว 12 บรรทัด เก็บ state ในเซฟ ล็อกผลด้วยเทสต์ known-answer | ใช้ได้ | ลองในพื้นที่ชั่วคราว · npm pure-rand เป็นทางสำรอง |
| ผลเหมือนกันข้ามเบราว์เซอร์ | (ไม่ระบุ) | ค่าของ Math.exp, pow, sin ต่างกันได้ระหว่างเบราว์เซอร์ golden run ที่ผ่านบน Node ไม่ได้รับประกันว่า Safari จะได้ผลเดียวกัน → เครื่องยนต์ใช้เลขจำนวนเต็ม | ความเสี่ยง | mdn/content Math index.md |
| schema ข้อมูล | ไฟล์ข้อมูลมี schema | zod 4.6.7 เป็นแหล่ง schema เดียว · เทสต์หนึ่งตัวตรวจไฟล์ข้อมูลทุกไฟล์ใน CI · ส่งออก JSON Schema ได้ | ใช้ได้ | colinhacks/zod v4.6.7 docs |
| เซฟ | IndexedDB | เซฟไม่กี่ชุดขนาดเล็ก localStorage พอ (5 MiB) · Safari ลบข้อมูลที่สคริปต์เขียนหลัง 7 วันของการใช้เบราว์เซอร์ที่ไม่ได้แตะเว็บนั้น ไม่ว่าจะเป็น IndexedDB หรือ localStorage → ต้องมีปุ่มส่งออก/นำเข้าไฟล์เซฟ · `navigator.storage.persist()` เรียกได้แต่พึ่งไม่ได้ | เปลี่ยน | mdn/content storage_quotas_and_eviction_criteria · @mdn/browser-compat-data 8.1.10 |
| ที่เก็บข้อมูลร่วม | (ไม่ระบุ) | ทุก repo ของเจ้าของเดียวกันบน GitHub Pages ใช้ origin เดียวกัน → คีย์เซฟต้องขึ้นต้นด้วยชื่อเกม เช่น `rattanava:save:v1:<slot>` | ความเสี่ยง | นิยาม same-origin (ยังไม่ได้ลองบน Pages) |
| PWA | PWA | ทั้ง iOS และ Android รองรับ · vite-plugin-pwa 2.0.0 build กับ Vite 8 ได้ แต่ service worker ไม่ช่วยกันเซฟหาย และเพิ่มปัญหาเวอร์ชันค้าง → เลื่อนออกไป | เปลี่ยน | npm vite-plugin-pwa · ลอง build ในพื้นที่ชั่วคราว |
| Web Worker | รันใน Web Worker | module worker ใช้ได้ตั้งแต่ iOS 15 · ยังไม่จำเป็นจนกว่าการคำนวณหนึ่งตาจะทำให้จอค้าง | เลื่อน | @mdn/browser-compat-data 8.1.10 |
| หน้าจอ | (ไม่ระบุ) | Preact 11.2.0 (ไม่ใช้ preact/compat) แอปเล็กสุดราว 6 kB gzip · React 19 ราว 67 kB · Svelte ใช้ TS 7 ตรวจไม่ได้ · Solid 2 เพิ่งออก 5 วัน | ใช้ได้ | preactjs/preact-www v11 upgrade guide · npm |
| ฟอนต์ | (ไม่ระบุ) | ทั้ง 4 ตระกูลเป็น SIL OFL 1.1 · @fontsource 5.3.0 มีชุดภาษาไทยครบ รวมราว 240 KB ต่อ 10 น้ำหนัก · IBM Plex มีชื่อสงวน "Plex" ห้ามแก้ไฟล์ฟอนต์เอง | ใช้ได้ | google/fonts METADATA.pb และ OFL.txt · npm @fontsource/* |
| แผนที่ | SVG | สร้าง path ของ 77 จังหวัดครั้งเดียวด้วย mapshaper (ระบุรุ่น) จาก chingchai/OpenGISData-Thailand commit fafcea1 · ไม่ต้องใช้ d3-geo · ใบอนุญาต CC BY 4.0 ระบุใน README เท่านั้น ไม่มีไฟล์ LICENSE · เครดิตต้องมีผู้สร้าง ลิงก์แหล่ง ลิงก์ใบอนุญาต และบอกว่าดัดแปลง | ใช้ได้ มีเงื่อนไข | OpenGISData-Thailand README · CC BY 4.0 legal code (mirror บน GitHub) |
| กราฟ | (ไม่ระบุ) | กราฟเล็ก 3 แผงเขียน SVG เอง · ไลบรารีที่ถูกที่สุดก็ยังราว 14 kB gzip | ใช้ได้ | ลองวัดขนาดในพื้นที่ชั่วคราว |
| โฮสต์และ CI | static | GitHub Pages ผ่าน Actions (checkout@v7, setup-node@v7, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5) · Royin ต้องเปิด Pages เองใน Settings | ใช้ได้ | vitejs/vite static-deploy-github-pages.yaml · README ของแต่ละ action |
| Node | (ไม่ระบุ) | Vitest 5 ต้องการ ^22.12 · 22.23.5 ในเครื่องเป็นรุ่นล่าสุดของ 22 · Node 22 หมดอายุ 30 เม.ย. 2570 ต้องย้ายไป 24 ก่อนวันนั้น | ใช้ได้ | nodejs/Release schedule.json |

## ยังไม่ได้ตรวจ

- ยังไม่ได้รันบนเบราว์เซอร์หรือเครื่องจริง: การลบข้อมูลหลัง 7 วันบน iPhone · ผลของ `persist()` · การติดตั้งลงหน้าจอหลัก · module worker · การแสดงฟอนต์ไทย · golden run บน Safari ให้ผลตรงกับ Node หรือไม่
- เว็บไอคอนบนหน้าจอหลักของ iOS ได้รับยกเว้นจากการลบ 7 วันหรือไม่ แหล่งยังขัดกัน · บั๊ก WebKit 271401 (persist() คืน false) แก้แล้วหรือไม่ · ทั้งสองข้อเห็นจากผลค้นหาเท่านั้น ยังไม่ได้เปิดหน้าจริง
- ยังไม่ได้เปิดบล็อกประกาศ TS 7.0 คำแนะนำให้ใช้ @typescript/typescript6 คู่กันมาจากข้อความย่อในผลค้นหา
- ผลของ sfc32 ยังไม่ได้เทียบกับ test vector ของตัวอ้างอิงภาษา C
- สิทธิ์ในข้อมูลเส้นขอบต้นทางของกรมการปกครอง
- รุ่นที่เลือกหลายตัวออกมาไม่ถึงสองสัปดาห์ (fast-check 4.11.0, Vitest 5.1.1, Vite 8.3.8) ทำงานร่วมกันได้ในการลอง แต่ถ้าต้องการรุ่นที่ออกมาแล้วอย่างน้อยสองสัปดาห์ ให้ล็อกรุ่น patch ที่เก่ากว่า
