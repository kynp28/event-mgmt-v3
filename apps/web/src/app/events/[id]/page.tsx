import { notFound } from "next/navigation";
import { fetchServer, fetchPublic, getServerSession } from "@/lib/api-server";
import Link from "next/link";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const res = await fetchServer(`/api/events/${id}`);
  if (!res.ok) return { title: "ไม่พบงาน" };
  const event = await res.json();
  return { title: event.name };
}

export default async function PublicEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetchServer(`/api/events/${id}`);
  
  if (!res.ok) {
    if (res.status === 404) notFound();
    throw new Error("ไม่สามารถโหลดข้อมูลงานได้");
  }

  const event = await res.json();
  const session = await getServerSession();

  let boothsRes;
  let boothsError = false;
  try {
    const bRes = await fetchPublic(`/api/events/${id}/booths`);
    if (!bRes.ok) {
      boothsError = true;
    } else {
      boothsRes = await bRes.json();
    }
  } catch {
    boothsError = true;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {event.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImage} alt={event.name} className="w-full h-64 object-cover rounded-lg mb-8" />
      )}
      <h1 className="text-4xl font-bold mb-4">{event.name}</h1>
      <p className="text-xl text-gray-600 mb-6">{event.location}</p>
      
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <p className="font-semibold">
          วันที่: {new Date(event.startDate).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} -{" "}
          {new Date(event.endDate).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}
        </p>
      </div>

      {event.description && (
        <div className="prose max-w-none mb-8">
          <p className="whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      {/* Map Section */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">แผนผังบูธ</h2>
          {event.status === "PUBLISHED" && (
            <div>
              {!session ? (
                <Link href="/login" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-medium">
                  เข้าสู่ระบบเพื่อจองบูธ
                </Link>
              ) : session.role === "VENDOR" ? (
                <Link href={`/vendor/events/${id}`} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-medium">
                  จองบูธ
                </Link>
              ) : null}
            </div>
          )}
        </div>
        
        {boothsError ? (
          <p className="text-red-500">ไม่สามารถโหลดแผนผังบูธได้</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {boothsRes && boothsRes.length > 0 ? boothsRes.map((booth: { status: string; code: string; storeName: string | null; productType: string | null; }) => {
              let label = "";
              let title = "";
              if (booth.status === "AVAILABLE") {
                label = "ว่าง";
              } else if (booth.status === "RESERVED") {
                label = "ไม่ว่าง";
              } else if (booth.status === "BOOKED") {
                if (booth.storeName) {
                  label = `${booth.storeName} (${booth.productType})`;
                  title = label;
                } else {
                  label = "ผู้ค้า (ยังไม่ระบุชื่อร้าน)";
                }
              }
              
              return (
                <div key={booth.code} className={`border p-4 rounded ${booth.status === "AVAILABLE" ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`} title={title}>
                  <p className="font-bold">{booth.code}</p>
                  <p className="text-sm truncate">{label}</p>
                </div>
              );
            }) : <p>ไม่มีบูธในระบบ</p>}
          </div>
        )}
      </div>
    </div>
  );
}
