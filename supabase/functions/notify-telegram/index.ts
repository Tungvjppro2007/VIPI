// Supabase Edge Function: notify-telegram
// Receives Database Webhook AFTER INSERT on orders table and forwards details to Telegram.

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables.");
    }

    const payload = await req.json();
    console.log("Received Webhook Payload:", JSON.stringify(payload, null, 2));

    // Webhook payload from Supabase has 'record' field for INSERT events
    const order = payload.record;
    if (!order) {
      return new Response(JSON.stringify({ error: "No order record found in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id, customer_name, phone, address, facebook_url, total_price } = order;

    // Helper to format currency
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
    };

    // Format Telegram message
    const message = `
🔔 <b>CÓ ĐƠN HÀNG MỚI!</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> ${customer_name}
📞 <b>Số điện thoại:</b> <code>${phone}</code>
🏠 <b>Địa chỉ:</b> ${address}
🔗 <b>Facebook:</b> ${facebook_url || "Không cung cấp"}
💰 <b>Tổng tiền:</b> <b>${formatCurrency(total_price)}</b>
🆔 <b>Mã đơn hàng:</b> <code>${id}</code>
━━━━━━━━━━━━━━━━━━
💬 <i>Vui lòng truy cập admin dashboard để xử lý.</i>
    `.trim();

    // Call Telegram API
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      console.error("Telegram API Error:", result);
      throw new Error(`Telegram API failed: ${result.description || response.statusText}`);
    }

    console.log("Telegram notification sent successfully.");
    return new Response(JSON.stringify({ success: true, message: "Notification sent." }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notify-telegram function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
