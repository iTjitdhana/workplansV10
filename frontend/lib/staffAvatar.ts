export const STAFF_IMAGE_MAP: Record<string, string> = {
  // Thai names
  จรัญ: "/images/staff/จรัญ.jpeg",
  แมน: "/images/staff/แมน.jpg",
  แจ็ค: "/images/staff/แจ็ค.jpg",
  ป้าน้อย: "/images/staff/ป้าน้อย.jpg",
  พี่ตุ่น: "/images/staff/พี่ตุ่น.jpg",
  เอ: "/images/staff/เอ.jpg",
  โอเล่: "/images/staff/โอเล่.jpg",
  พี่ภา: "/images/staff/พี่ภา.jpg",
  อาร์ม: "/images/staff/อาร์ม.jpg",
  สาม: "/images/staff/สาม.jpg",
  พี่สัญญา: "/images/staff/พี่สัญญา.jpg",
  จิ๋ว: "/images/staff/จิ๋ว.jpg",
  RD: "/images/staff/RD.jpg",

  // id_code / aliases
  arm: "/images/staff/อาร์ม.jpg",
  saam: "/images/staff/สาม.jpg",
  toon: "/images/staff/พี่ตุ่น.jpg",
  man: "/images/staff/แมน.jpg",
  sanya: "/images/staff/พี่สัญญา.jpg",
  noi: "/images/staff/ป้าน้อย.jpg",
  pha: "/images/staff/พี่ภา.jpg",
  ae: "/images/staff/เอ.jpg",
  rd: "/images/staff/RD.jpg",
  Ola: "/images/staff/โอเล่.jpg",
  JJ: "/images/staff/จรัญ.jpeg",
  Jak: "/images/staff/แจ็ค.jpg",
};

const STAFF_INITIAL_MAP: Record<string, string> = {
  พี่สร: "ส",
  สร: "ส",
  sorn: "ส",
  somlee: "ล",
  สำลี: "ล",
  พี่สำลี: "ล",
  rd: "RD",
  turk: "ท",
  nine: "N",
  lin: "L",
};

const isThai = (text: string) => /[\u0E00-\u0E7F]/.test(text);

export const getStaffImage = (name: string): string | undefined => {
  const raw = String(name || "").trim();
  if (!raw) return undefined;

  return (
    STAFF_IMAGE_MAP[raw] ||
    STAFF_IMAGE_MAP[raw.toLowerCase()] ||
    STAFF_IMAGE_MAP[raw.toUpperCase()]
  );
};

export const getStaffInitial = (name: string): string => {
  const raw = String(name || "").trim();
  if (!raw) return "?";

  const mapped = STAFF_INITIAL_MAP[raw.toLowerCase()];
  if (mapped) return mapped;

  if (isThai(raw)) {
    return raw.charAt(0);
  }

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }

  if (raw.length <= 2) return raw.toUpperCase();
  return raw.charAt(0).toUpperCase();
};

