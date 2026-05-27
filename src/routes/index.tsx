import { createFileRoute } from "@tanstack/react-router";
import TripTrackApp from "@/components/TripTrackApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EJH Check In — ระบบบันทึกงาน & GPS" },
      { name: "description", content: "EJH Check In: ระบบเช็คอินงานนอกสถานที่ พร้อม GPS, คำนวณค่าเดินทาง และแจ้งเตือนผ่าน LINE" },
    ],
  }),
  component: () => <TripTrackApp />,
});
