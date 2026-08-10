import { createFileRoute } from "@tanstack/react-router";
import TripTrackApp from "@/components/TripTrackApp";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "หน้าใช้งาน | EJH Check In" },
      { name: "description", content: "บันทึกงานนอกสถานที่ พร้อม GPS คำนวณค่าเดินทาง และรายงานสรุปรายวันของพนักงาน" },
      { property: "og:title", content: "หน้าใช้งาน | EJH Check In" },
      { property: "og:description", content: "บันทึกงานนอกสถานที่ พร้อม GPS คำนวณค่าเดินทาง และรายงานสรุปรายวัน" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TripTrackApp />,
});
