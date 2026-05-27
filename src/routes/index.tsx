import { createFileRoute } from "@tanstack/react-router";
import TripTrackApp from "@/components/TripTrackApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TripTrack Pro — บันทึกงาน & GPS" },
      { name: "description", content: "ระบบบันทึกงานนอกสถานที่ พร้อม GPS, คำนวณค่าเดินทาง และรายงาน" },
    ],
  }),
  component: () => <TripTrackApp />,
});
