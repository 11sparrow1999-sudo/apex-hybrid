import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageBase64 = body?.imageBase64;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY en el entorno del servidor." },
        { status: 500 }
      );
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "No se recibió una imagen válida para analizar." },
        { status: 400 }
      );
    }

    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

    const prompt = `Eres un nutricionista deportivo analizando una foto capturada desde la cámara de un usuario.
1. Revisa si en la imagen hay COMIDA, BEBIDA o una ETIQUETA DE INFORMACIÓN NUTRICIONAL.
2. Si NO hay comida, bebida ni etiqueta nutricional (por ejemplo: un teclado, una pared, un zapato, un objeto cualquiera), pon "is_food": false y todos los números en 0.
3. Si SÍ hay comida o etiqueta nutricional:
   - Si es una etiqueta nutricional, prioriza los valores indicados en la etiqueta (ajustados a la porción visible si se aprecia).
   - Si es un plato o alimento, estima de forma realista calorías, proteínas (g), carbohidratos (g) y grasas (g).
Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "is_food": boolean,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fats_g": number,
  "summary": "descripción breve en español de lo detectado"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Error de Gemini (${response.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);

    const isFood = Boolean(parsed.is_food);

    return NextResponse.json({
      is_food: isFood,
      calories: isFood ? Math.max(0, Math.round(Number(parsed.calories) || 0)) : 0,
      protein_g: isFood ? Math.max(0, Math.round(Number(parsed.protein_g) || 0)) : 0,
      carbs_g: isFood ? Math.max(0, Math.round(Number(parsed.carbs_g) || 0)) : 0,
      fats_g: isFood ? Math.max(0, Math.round(Number(parsed.fats_g) || 0)) : 0,
      summary:
        String(parsed.summary || "").trim() ||
        (isFood ? "Alimento detectado" : "No se detectó comida ni etiqueta nutricional"),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado al analizar la imagen." },
      { status: 500 }
    );
  }
}