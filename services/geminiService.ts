
import { GoogleGenAI, Type } from "@google/genai";
import { ToxicityReport, ScannedReceiptData, Transaction, TaxDraftData, TaxQuestionnaire, TaxDeduction, TransactionType, Receipt, Credit, InsurancePolicy } from '../types.ts';

// --- IndexedDB Service for File Storage ---
const DB_NAME = 'MoneyGrowthFiles';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error("IndexedDB error:", request.error);
            reject("IndexedDB error");
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveFile = async (id: string, data: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ id, data });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getFile = async (id: string): Promise<string | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result?.data || null);
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteFile = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};


// --- Gemini API Service ---

// Always initialize with process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-3-flash-preview';

const safeRun = async <T,>(apiCall: () => Promise<T>, fallback: T): Promise<T> => {
    try {
        return await apiCall();
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return fallback;
    }
};

export const analyzeCreditToxicity = async (
  totalAmount: number,
  monthlyPayment: number,
  tin: number,
  tae: number,
  loanTermInMonths: number
): Promise<ToxicityReport> => safeRun(async () => {
  const prompt = `
    Eres un asesor financiero experto. Analiza la "toxicidad" del siguiente préstamo personal para un usuario medio.
    Considera la relación entre la cuota mensual, los tipos de interés (TIN y TAE), el importe total y la duración del préstamo.
    Proporciona una puntuación de toxicidad de 1 (muy seguro) a 10 (extremadamente arriesgado) y una breve explicación clara y sencilla.

    Detalles del préstamo:
    - Importe total: ${totalAmount} €
    - Cuota mensual: ${monthlyPayment} €
    - TIN (Tipo de Interés Nominal): ${tin}%
    - TAE (Tasa Anual Equivalente): ${tae}%
    - Duración: ${loanTermInMonths} meses

    Devuelve tu análisis únicamente en formato JSON.
  `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { 
                        type: Type.NUMBER,
                        description: "La puntuación de toxicidad de 1 a 10."
                    },
                    explanation: { 
                        type: Type.STRING,
                        description: "Una explicación breve y sencilla de por qué se asignó esa puntuación."
                    }
                },
                required: ["score", "explanation"],
            }
        }
    });
    
    const parsedResponse = JSON.parse(response.text);

    if (typeof parsedResponse.score !== 'number' || typeof parsedResponse.explanation !== 'string') {
        throw new Error("Invalid response format from Gemini API");
    }

    return parsedResponse as ToxicityReport;

}, {
    score: 0,
    explanation: "No se pudo analizar el crédito. Hubo un error al contactar con la IA."
});

export const getFinancialInsights = async (userQuery: string, financialData: string): Promise<string> => safeRun(async () => {
  const systemInstruction = `
    Eres un asesor financiero experto y amigable llamado MoneyGrowth AI. Tu tarea es analizar los datos financieros del usuario (en formato JSON) y responder a sus preguntas de forma clara, concisa y útil.
    - Utiliza los datos proporcionados para fundamentar tus respuestas.
    - Ofrece consejos prácticos, accionables y fáciles de entender.
    - Formatea tu respuesta usando Markdown para una mejor legibilidad (usa títulos, listas, negritas, etc.).
    - No inventes datos. Si la información no está en los datos proporcionados, indícalo.
    - Sé directo y evita el lenguaje financiero demasiado complejo.
    - No menciones que eres un modelo de lenguaje ni que estás analizando un JSON, simplemente da la respuesta como un asesor.
  `;
  const contents = `AQUÍ ESTÁN MIS DATOS FINANCIEROS:\n${financialData}\n\nESTA ES MI PREGUNTA:\n"${userQuery}"`;

  const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.5 } });
  return response.text;
}, "Lo siento, ha ocurrido un error al intentar generar el análisis.");

export const analyzeReceiptImage = async (base64Image: string, mimeType: string): Promise<ScannedReceiptData> => safeRun(async () => {
    const prompt = "Analiza la imagen de este recibo o factura. Extrae el importe total, la fecha, una descripción breve o el nombre del comercio, y sugiere una categoría de gasto de las siguientes: Vivienda, Transporte, Alimentación, Ocio, Salud, Finanzas, Seguros, Ropa, Educación, Regalos, Otros. Devuelve la fecha en formato YYYY-MM-DD.";
    const imagePart = { inlineData: { data: base64Image, mimeType } };

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    amount: { type: Type.NUMBER, description: "El importe total del recibo." },
                    date: { type: Type.STRING, description: "La fecha del recibo en formato YYYY-MM-DD." },
                    description: { type: Type.STRING, description: "Nombre del comercio o descripción breve." },
                    category: { type: Type.STRING, description: "La categoría de gasto sugerida." },
                },
            },
        },
    });

    const parsedResponse = JSON.parse(response.text);
    if (parsedResponse.date && !/^\d{4}-\d{2}-\d{2}$/.test(parsedResponse.date)) {
        parsedResponse.date = new Date().toISOString().split('T')[0];
    }
    return parsedResponse as ScannedReceiptData;

}, { description: "No se pudo analizar el recibo por un error de la IA. Introduce los datos manualmente." });

export const getAIFinancialSummary = async (transactions: Transaction[]): Promise<string> => safeRun(async () => {
  const systemInstruction = `
    Eres un asesor financiero experto y amigable llamado MoneyGrowth AI. Tu tarea es analizar un listado de las transacciones de los últimos 30 días y generar un resumen breve y útil en lenguaje natural.
    - Compara el gasto total con el ingreso total.
    - Señala la categoría con mayor gasto.
    - Ofrece una recomendación o un dato curioso.
    - El resumen debe ser corto, de 2 a 3 frases.
    - Formatea la respuesta en Markdown. Usa negritas para destacar cifras o categorías.
  `;
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const recentTransactions = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
  if (recentTransactions.length === 0) return "No hay transacciones recientes para analizar.";

  const contents = `Datos de transacciones:\n${JSON.stringify(recentTransactions, null, 2)}`;
  const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.6 } });
  return response.text;
}, "No se pudo generar el resumen financiero.");

export const getPredictiveAnalysis = async (financialData: string): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un analista financiero predictivo llamado MoneyGrowth AI. Tu tarea es analizar el historial financiero del usuario y realizar una previsión para los próximos 3 meses.
    - Estima los ingresos y gastos totales para cada uno de los próximos 3 meses.
    - Identifica tendencias clave (ej. "Tus gastos en Ocio tienden a aumentar un 15% en verano").
    - Proporciona un breve resumen de la previsión.
    - Usa un tono profesional pero accesible.
    - Formatea la respuesta usando Markdown (títulos, listas, tablas si es necesario).
  `;
    const contents = `Datos históricos:\n${financialData}`;
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.5 } });
    return response.text;
}, "No se pudo generar la previsión financiera.");

export const getSavingsRecommendations = async (financialData: string): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un asesor de finanzas personales llamado MoneyGrowth AI. Tu misión es ayudar al usuario a ahorrar dinero.
    - Analiza el historial de gastos proporcionado.
    - Identifica las 3 principales categorías donde el usuario podría recortar gastos.
    - Para cada categoría, ofrece de 1 a 2 consejos concretos y accionables (ej. "Considera cambiar tu suscripción de 'Premium+' a 'Básica' para ahorrar X€/mes").
    - Si detectas gastos recurrentes elevados (recibos, seguros), sugiere buscar alternativas más económicas.
    - Finaliza con una frase de ánimo.
    - Usa un tono amigable y motivador.
    - Formatea la respuesta usando Markdown (títulos, listas con bullets, negritas).
  `;
    const contents = `Datos de gastos:\n${financialData}`;
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.7 } });
    return response.text;
}, "No se pudieron generar las recomendaciones de ahorro.");

export const extractDataFromTaxPDF = async (
    base64Pdf: string,
    mimeType: string,
): Promise<TaxDraftData> => safeRun(async () => {
    const prompt = `
        Eres un experto asesor fiscal en España. Analiza el documento PDF adjunto, que es un borrador de la declaración de la renta (Modelo 100).
        Extrae los siguientes valores numéricos clave de las casillas correspondientes y devuélvelos en formato JSON.
        No incluyas el símbolo del euro ni separadores de miles, solo el número. Si un valor es negativo, inclúyelo.

        1.  **Ingresos brutos del trabajo**: Busca la casilla [0012] "Total ingresos íntegros computables".
        2.  **Retenciones por trabajo**: Busca la casilla [0021] o similar, referente a "Retenciones por rendimientos del trabajo".
        3.  **Gastos deducibles (Seguridad Social)**: Busca la casilla [0019] o similar, "Cotizaciones a la Seguridad Social".
        4.  **Resultado del borrador**: Busca la casilla [0595] o [0670], que es la "Cuota resultante de la autoliquidación". Si el valor es negativo (a devolver), el número debe ser negativo.
    `;
    const pdfPart = { inlineData: { data: base64Pdf, mimeType } };

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [pdfPart, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    grossIncome: { type: Type.NUMBER, description: "Valor de la casilla 0012. Ingresos brutos." },
                    withholdings: { type: Type.NUMBER, description: "Valor de la casilla 0021. Retenciones." },
                    socialSecurity: { type: Type.NUMBER, description: "Valor de la casilla 0019. Cotizaciones a la SS." },
                    draftResult: { type: Type.NUMBER, description: "Valor de la casilla 0595 o 0670. Resultado final." }
                },
                required: ["grossIncome", "withholdings", "socialSecurity", "draftResult"],
            },
        },
    });

    return JSON.parse(response.text) as TaxDraftData;

}, {
    grossIncome: 0,
    withholdings: 0,
    socialSecurity: 0,
    draftResult: 0,
});

export const getTaxAdvice = async (
    draftData: TaxDraftData,
    questionnaire: TaxQuestionnaire,
    deductibleReceipts: Receipt[]
): Promise<{ advice: string; deductions: TaxDeduction[] }> => safeRun(async () => {
    const systemInstruction = `
    Eres un asesor fiscal experto en la declaración de la renta (IRPF) en España. Tu objetivo es analizar los datos del borrador y un cuestionario detallado para encontrar deducciones y optimizaciones.

    Basado en el cuestionario, identifica todas las deducciones aplicables. Para cada una, calcula el impacto estimado en la cuota final (el ahorro).

    Reglas de cálculo (usa un tipo marginal medio del 30% para estimar reducciones de base):
    - **Mínimo por descendientes**: 2400€ por el 1º, 2700€ por el 2º, 4000€ por el 3º, 4500€ por el 4º y siguientes. Aumento por menores de 3 años: 2800€. Impacto = (deducción) * 0.30.
    - **Mínimo por ascendientes**: 1150€ por mayor de 65, +1400€ si > 75. Impacto = (deducción) * 0.30.
    - **Mínimo por discapacidad**: Depende del grado, pero estima un impacto medio de 900€ si hay discapacidad.
    - **Vivienda habitual (hipoteca < 2013)**: Deducción del 15% para contratos anteriores a 2015 y base < 24107€. Simplifica y aplica una deducción del 5% del importe anual pagado si el contrato es antiguo.
    - **Ingresos por alquiler (como arrendador)**: Si existe el array 'rented_properties' y no está vacío, suma el rendimiento neto de cada propiedad (ingresos - gastos). Sobre el total de rendimientos netos, aplica una reducción del 60%. Esto *aumentará* lo que hay que pagar. Impacto = (rendimiento_neto_total * 0.40) * 0.30 (tipo marginal). El impacto es negativo (aumenta el pago). En el texto del consejo, **menciona las propiedades por su nombre ('name')**.
    - **Gastos deducibles (facturas)**: Si 'work_autonomousExpenses' > 0, es un gasto deducible. **DEBES OBLIGATORIAMENTE** crear una entrada en el array 'deductions' para 'Gastos Deducibles (Facturas)'. El impacto es 'work_autonomousExpenses * 0.30'.
    - **Planes de pensiones**: Reducen la base imponible. Impacto = min(aportado, 1500) * 0.30.
    - **Donativos a ONGs**: 80% de deducción para los primeros 250€. 40% para el resto. Impacto = (min(donado, 250) * 0.80) + (max(0, donado - 250) * 0.40).
    - **Cuotas sindicales**: Reducen la base imponible. Impacto = (cuota_pagada) * 0.30.
    - **Deducciones autonómicas (guardería, gimnasio, etc.)**: Estima el impacto como el 15% del total de estos gastos.
    - **Familia numerosa**: Deducción fija de 1200€ (general) o 2400€ (especial).

    Proporciona un consejo general en formato Markdown, explicando los hallazgos de forma clara y amigable.
    En tu respuesta de 'advice' en Markdown, **ES OBLIGATORIO** que incluyas una sección titulada '### Desglose de Gastos Deducibles' y listes cada factura del array 'deductibleReceipts' que te proporciono, mostrando su título ('title') y su importe ('amount'). Si el array está vacío, indica que no hay gastos desglosados.

    Devuelve tu análisis únicamente en formato JSON.
    `;
    const contents = `DATOS:\n${JSON.stringify({ draftData, questionnaire, deductibleReceipts }, null, 2)}`;
    
    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    advice: {
                        type: Type.STRING,
                        description: "Un resumen en formato Markdown con consejos y explicaciones sobre las deducciones aplicadas y otros consejos fiscales, incluyendo el desglose de facturas."
                    },
                    deductions: {
                        type: Type.ARRAY,
                        description: "Un array de objetos, cada uno representando una deducción aplicable.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: {
                                    type: Type.STRING,
                                    description: "Descripción clara de la deducción (ej: 'Donativo a ONG')."
                                },
                                amount: {
                                    type: Type.NUMBER,
                                    description: "La cantidad base de la deducción (ej: el importe donado)."
                                },
                                impactOnResult: {
                                    type: Type.NUMBER,
                                    description: "El impacto estimado en la cuota final. Positivo si reduce el pago (ahorro), negativo si lo aumenta (ej: ingresos no declarados)."
                                }
                            },
                            required: ["description", "amount", "impactOnResult"]
                        }
                    }
                },
                required: ["advice", "deductions"]
            }
        }
    });

    return JSON.parse(response.text) as { advice: string; deductions: TaxDeduction[] };

}, {
    advice: "No se pudo realizar el análisis fiscal por un error de la IA.",
    deductions: []
});


// --- AI Chat Assistant Service ---

export const getChatResponseWithTools = async (
  currentMessage: string, 
  chatHistory: { role: string, parts: { text: string }[] }[],
  categories: { income: string[], expense: string[]}
) => safeRun(async () => {
    const tools = [{
        functionDeclarations: [
            {
                name: "addTransaction",
                description: "Añade una nueva transacción de ingreso o gasto. La fecha por defecto es hoy si no se especifica. El tipo (type) debe ser 'income' o 'expense'.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        type: {
                            type: Type.STRING,
                            enum: ["income", "expense"],
                            description: "El tipo de transacción."
                        },
                        amount: {
                            type: Type.NUMBER,
                            description: "El importe de la transacción."
                        },
                        category: {
                            type: Type.STRING,
                            description: `La categoría de la transacción. Debe ser una de las siguientes: Ingresos: ${categories.income.join(', ')}. Gastos: ${categories.expense.join(', ')}.`,
                        },
                         description: {
                            type: Type.STRING,
                            description: "Una descripción opcional de la transacción."
                        },
                    },
                    required: ["type", "amount", "category"]
                }
            }
        ]
    }];

    const response = await ai.models.generateContent({
        model,
        contents: [...chatHistory, { role: 'user', parts: [{ text: currentMessage }] }],
        config: {
            tools,
        }
    });
    
    return response;
}, null);

export const analyzePropertyInvestment = async (
  metrics: {
    roi: number;
    netYield: number;
    monthlyCashFlow: number;
    ownCapitalNeeded: number;
    recoveryYears: number;
    purchasePrice: number;
  }
): Promise<string> => safeRun(async () => {
  const systemInstruction = `
    Eres un experto inversor inmobiliario con décadas de experiencia en el mercado español. Tu tono es profesional, objetivo y didáctico.
    Analiza los siguientes datos de una oportunidad de inversión inmobiliaria y proporciona un veredicto claro y estructurado en formato Markdown.

    Tu análisis debe contener obligatoriamente las siguientes secciones:
    - ### Resumen General
      (Una breve descripción de la inversión y tu primera impresión).
    - ### Puntos Fuertes
      (Enumera los aspectos más positivos de la inversión, como un buen cash flow, un ROI atractivo, una barrera de entrada baja, etc.).
    - ### Riesgos y Puntos Débiles
      (Enumera los posibles riesgos o desventajas, como una alta dependencia de la financiación, un cash flow ajustado, un periodo de recuperación largo, etc.).
    - ### Conclusión
      (Un párrafo final con tu opinión sobre si la inversión es recomendable, para qué tipo de inversor, y qué debería vigilar).

    Utiliza los datos proporcionados para fundamentar cada punto. Sé directo y evita el lenguaje excesivamente técnico.
  `;
  const contents = `
    Por favor, analiza esta inversión inmobiliaria:
    - **Precio de Compra:** ${metrics.purchasePrice.toFixed(2)} €
    - **Capital Propio Necesario (Entrada + Gastos):** ${metrics.ownCapitalNeeded.toFixed(2)} €
    - **ROI (Retorno sobre Capital Propio):** ${metrics.roi.toFixed(2)}%
    - **Rentabilidad Neta:** ${metrics.netYield.toFixed(2)}%
    - **Cash Flow Mensual (Prudente):** ${metrics.monthlyCashFlow.toFixed(2)} €/mes
    - **Años para Recuperar Inversión (con Cash Flow):** ${isFinite(metrics.recoveryYears) ? metrics.recoveryYears.toFixed(1) : 'N/A'} años
  `;
  
  const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.6 } });
  return response.text;

}, "No se pudo generar el veredicto de la IA.");


export const getDebtAdvice = async (
  userQuery: string,
  credits: Credit[]
): Promise<string> => safeRun(async () => {
  const systemInstruction = `
    Eres un asesor financiero experto, amigable y alentador llamado MoneyGrowth AI. Tu especialidad es ayudar a las personas a entender y gestionar su deuda de manera efectiva.
    
    Analizarás un listado de los créditos actuales del usuario (en formato JSON) para responder a su pregunta. Tu objetivo es proporcionar consejos claros, personalizados y accionables.

    Instrucciones clave:
    1.  **Personaliza la respuesta**: Utiliza los nombres de los créditos (ej. "Préstamo Coche", "Tarjeta Visa") que se proporcionan en los datos para que el consejo sea específico para el usuario.
    2.  **Explica conceptos clave**: Si el usuario pregunta por estrategias, explica de forma sencilla qué es el método "Bola de Nieve" (pagar primero las deudas con el saldo más pequeño) y el método "Avalancha" (pagar primero las deudas con el tipo de interés (TAE) más alto).
    3.  **Sé Proactivo**: Si identificas múltiples créditos con TAEs altas, sugiere proactivamente la posibilidad de una consolidación de deuda, explicando brevemente sus pros (una sola cuota, posible interés más bajo) y contras (posiblemente un plazo más largo).
    4.  **Ofrece estrategias claras**: Basado en los datos, si te piden una recomendación, sugiere una estrategia (Bola de Nieve o Avalancha) y explica por qué es una buena opción para su situación. Muestra el orden de pago que deberían seguir.
    5.  **Tono**: Mantén un tono positivo, motivador y libre de juicios. El objetivo es empoderar al usuario, no asustarlo.
    6.  **Formato**: Usa Markdown para que la respuesta sea fácil de leer (títulos, listas con viñetas, negritas, etc.).
    
    No inventes datos. Si la información no está disponible, indícalo. No menciones que eres un modelo de IA ni que estás analizando un JSON.
  `;
  
  const contents = `AQUÍ ESTÁN MIS CRÉDITOS:\n${JSON.stringify(credits, null, 2)}\n\nESTA ES MI PREGUNTA:\n"${userQuery}"`;

  const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.7 } });
  return response.text;

}, "Lo siento, no he podido generar el consejo sobre deudas por un error de la IA.");


export const getTaxPlanningAdvice = async (
  userQuery: string,
  financialData: string,
  chatHistory: { role: string, parts: { text: string }[] }[]
): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un asesor fiscal experto en España, especializado en planificación fiscal para particulares, autónomos y pequeñas empresas. Tu objetivo es proporcionar estrategias **legales y éticas** para optimizar la carga fiscal del usuario, basándote en la legislación española actual.

    **Reglas Fundamentales:**
    1.  **Legalidad ante todo:** Distingue claramente entre elusión fiscal (estratégias legales para minimizar impuestos) y evasión fiscal (ilegal). Nunca, bajo ninguna circunstancia, recomiendes o sugieras acciones ilegales.
    2.  **Personalización:** Analiza los datos financieros proporcionados (ingresos, gastos, inversiones, créditos, etc.) para dar consejos personalizados y relevantes para la situación del usuario.
    3.  **Claridad:** Usa un lenguaje claro y evita la jerga fiscal excesiva. Explica conceptos complejos de forma sencilla.
    4.  **Formato:** Utiliza Markdown para estructurar tus respuestas (títulos, listas, negritas) para una fácil lectura.
    5.  **Descargo de Responsabilidad:** **OBLIGATORIO**: Finaliza cada respuesta con el siguiente descargo de responsabilidad en una sección separada:
        "--- \n**Aviso Importante:** Esta información es una simulación generada por IA y no constituye asesoramiento fiscal profesional. Las leyes fiscales son complejas y pueden cambiar. Te recomiendo encarecidamente que consultes con un asesor fiscal cualificado antes de tomar cualquier decisión financiera."

    **Áreas de especialización que debes cubrir si el usuario pregunta:**
    *   **IRPF:** Optimización de la declaración, deducciones estatales y autonómicas, fiscalidad de productos de ahorro e inversión (acciones, fondos, criptomonedas, inmuebles).
    *   **Autónomos vs. Sociedad Limitada (S.L.):** Compara ventajas y desventajas (costes, impuestos, responsabilidad, etc.) basándote en los ingresos y tipo de actividad del usuario.
    *   **Creación de Empresas:** Ofrece una visión general de los pasos y consideraciones para crear una S.L. en España.
    *   **Inversión Fiscalmente Eficiente:** Explica vehículos como planes de pensiones, fondos de inversión, PIAS, etc., y sus implicaciones fiscales.
    *   **Planificación Patrimonial:** Nociones básicas sobre el Impuesto de Sucesiones y Donaciones y estrategias de planificación.

    Responde directamente a la pregunta del usuario utilizando el contexto de la conversación y los datos financieros proporcionados.
    `;
    const contents = [
        ...chatHistory,
        { role: 'user', parts: [{ text: `Aquí están mis datos financieros actuales para dar contexto a mi pregunta:\n${financialData}\n\nMi pregunta es: "${userQuery}"` }] }
    ];

    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.6 } });
    return response.text;

}, "Lo siento, ha ocurrido un error al intentar generar el consejo fiscal.");


export const getAIBudgetSuggestion = async (
    transactions: Transaction[]
): Promise<{ summary: string; suggestedBudgets: { category: string; targetAmount: number; priority: 'essential' | 'secondary' }[] }> => safeRun(async () => {
    const systemInstruction = `
    Eres un asesor financiero experto. Tu tarea es analizar los ingresos y gastos de los últimos 3 meses de un usuario y proponer un presupuesto mensual basado en la regla 50/30/20 (50% Necesidades, 30% Deseos, 20% Ahorro).

    1.  **Calcula el Ingreso Mensual Promedio** a partir de las transacciones de tipo 'income'.
    2.  **Aplica la regla 50/30/20** a ese ingreso para determinar las cantidades totales para Necesidades, Deseos y Ahorro.
    3.  **Analiza los gastos** (transacciones de tipo 'expense') y agrúpalos por categoría.
    4.  **Clasifica cada categoría de gasto** como 'essential' (Necesidad) o 'secondary' (Deseo). Por ejemplo, 'Vivienda' y 'Alimentación' son 'essential'. 'Ocio' y 'Compras' son 'secondary'.
    5.  **Sugiere un límite de gasto** (targetAmount) para cada categoría de gasto principal, asegurándote de que la suma de los límites de 'Necesidades' no exceda el 50% del ingreso, y la de 'Deseos' no exceda el 30%. Ajusta las cantidades de forma razonable.
    6.  **Escribe un resumen breve y amigable** explicando el presupuesto propuesto.
    7.  Devuelve el resultado en formato JSON.
  `;
    const contents = `Aquí están las transacciones de los últimos 3 meses:\n${JSON.stringify(transactions, null, 2)}`;

    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: {
                        type: Type.STRING,
                        description: "Un resumen en Markdown explicando el presupuesto sugerido."
                    },
                    suggestedBudgets: {
                        type: Type.ARRAY,
                        description: "Una lista de presupuestos sugeridos para las categorías de gasto.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING, description: "La categoría del gasto." },
                                targetAmount: { type: Type.NUMBER, description: "El límite de gasto mensual sugerido." },
                                priority: { type: Type.STRING, enum: ["essential", "secondary"], description: "La prioridad del gasto (Necesidad o Deseo)." }
                            },
                            required: ["category", "targetAmount", "priority"]
                        }
                    }
                },
                required: ["summary", "suggestedBudgets"]
            }
        }
    });

    return JSON.parse(response.text);
}, {
    summary: "No se pudo generar la sugerencia inteligente.",
    suggestedBudgets: []
});

export const findSavingsOpportunities = async (
    receipts: Receipt[],
    insurancePolicies: InsurancePolicy[]
): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un experto en ahorro y finanzas personales llamado "Cazador de Ahorros IA". Tu misión es analizar los gastos recurrentes (recibos y seguros) de un usuario y encontrar oportunidades concretas para ahorrar dinero.
    - Analiza la lista de seguros y recibos proporcionada.
    - Identifica los 2-3 gastos más elevados o áreas donde es común encontrar mejores ofertas (ej. seguros de coche, facturas de telefonía/internet, seguros de salud).
    - Para cada oportunidad identificada, proporciona un consejo claro y accionable. Por ejemplo:
      - "Tu seguro de coche con [Compañía] tiene una prima de [Prima]€. Es un buen momento para usar comparadores online y pedir presupuestos a otras aseguradoras. A menudo se pueden encontrar ahorros de más del 20% por las mismas coberturas."
      - "Veo que pagas [Importe]€ por tu factura de internet/móvil. Llama a tu compañía y pregunta por nuevas ofertas o amenaza con cambiarte. Es una estrategia muy efectiva para conseguir descuentos."
    - Mantén un tono proactivo, amigable y motivador.
    - Formatea la respuesta en Markdown, usando títulos, listas y negritas para que sea fácil de leer.
    - Si no encuentras oportunidades claras, felicita al usuario por tener sus gastos optimizados y anímale a revisar sus contratos anualmente.
  `;
    const contents = `Aquí están mis gastos recurrentes:\nSeguros: ${JSON.stringify(insurancePolicies, null, 2)}\nRecibos: ${JSON.stringify(receipts.filter(r => r.type === 'receipt'), null, 2)}`;
    
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.7 } });
    return response.text;
}, "No se pudieron encontrar oportunidades de ahorro por un error de la IA.");

export const getInvestmentAdvice = async (
    userQuery: string,
    financialData: string,
    chatHistory: { role: string, parts: { text: string }[] }[]
): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un coach de inversión amigable y didáctico para principiantes. Tu nombre es MoneyGrowth Coach. Tu objetivo es desmitificar la inversión y guiar al usuario en sus primeros pasos de forma segura y comprensible, siempre basándote en la legislación y productos comunes en España.

    **Reglas Fundamentales:**
    1.  **Enfoque en Principiantes:** Utiliza analogías y un lenguaje sencillo. Evita la jerga compleja. Explica conceptos como ETFs, fondos indexados, diversificación, etc., como si hablaras con un amigo.
    2.  **Educación Primero, no Recomendaciones:** NO dar consejos de inversión específicos (ej: "compra acciones de X empresa"). En su lugar, educa sobre los tipos de productos y estrategias (ej: "Una estrategia popular para empezar es invertir en un fondo indexado al S&P 500 o al MSCI World porque te permite diversificar con bajo coste").
    3.  **Contexto Financiero:** Utiliza los datos financieros del usuario (especialmente sus ahorros y capacidad de ahorro mensual) para personalizar tus explicaciones.
    4.  **Fiscalidad Española:** Cuando sea relevante, menciona de forma sencilla las implicaciones fiscales en España (ej: "Los fondos de inversión tienen la ventaja de que puedes traspasar tu dinero de un fondo a otro sin pagar impuestos por las ganancias hasta que lo vendas definitivamente").
    5.  **Formato:** Usa Markdown para estructurar tus respuestas (títulos, listas, negritas).
    6.  **Descargo de Responsabilidad:** **OBLIGATORIO**: Finaliza cada respuesta con el siguiente descargo de responsabilidad:
        "--- \n**Aviso Importante:** Esta información es educativa y generada por IA. No constituye asesoramiento financiero profesional. Invertir conlleva riesgos. Te recomiendo encarecidamente que consultes con un asesor financiero cualificado y hagas tu propia investigación antes de tomar cualquier decisión de inversión."

    **Áreas de conocimiento:**
    *   Conceptos básicos: Interés compuesto, diversificación, riesgo vs. rentabilidad.
    *   Productos para principiantes: Fondos indexados, ETFs, Robo-advisors.
    *   Estrategias: Dollar Cost Averaging (DCA), inversión a largo plazo.
    *   Siguientes pasos: Cómo abrir una cuenta en un broker, qué buscar en una plataforma.

    Responde a la pregunta del usuario utilizando el contexto de la conversación y sus datos.
    `;
    const contents = [
        ...chatHistory,
        { role: 'user', parts: [{ text: `Aquí están mis datos financieros para dar contexto a mi pregunta:\n${financialData}\n\nMi pregunta es: "${userQuery}"` }] }
    ];
    
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.6 } });
    return response.text;
}, "Lo siento, ha ocurrido un error al intentar generar el consejo de inversión.");

export const getInvestmentTaxAdvice = async (
    investmentData: string,
    taxLiability: number
): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un asesor fiscal experto en tributación de inversiones en España.
    Tu objetivo es analizar la cartera de inversiones del usuario y su cálculo estimado de impuestos sobre el ahorro para sugerir estrategias de optimización fiscal LEGALES.

    Analiza:
    1. Las ganancias y pérdidas patrimoniales realizadas (ventas).
    2. Las inversiones actuales (no vendidas).
    3. El tipo de activos (Cripto, Acciones, Fondos, etc.).

    Proporciona:
    - Un análisis breve de su situación actual.
    - Estrategias concretas para reducir la factura fiscal (ej: compensación de pérdidas y ganancias, regla de los 2 meses en acciones, traspaso de fondos sin peaje fiscal, deducciones específicas si aplican).
    - Explicación clara de cómo funcionan los tramos del ahorro si el usuario tiene dudas implícitas en sus datos.
    - **IMPORTANTE**: Si detectas pérdidas no realizadas (inversiones en negativo no vendidas), sugiere la posibilidad de venderlas para compensar ganancias (Tax-loss harvesting) antes de fin de año.

    Formato: Markdown. Tono: Profesional pero accesible.
    Descargo: Finaliza siempre recordando que esto es una simulación y no sustituye a un asesor fiscal colegiado.
    `;

    const contents = `CARTERA DE INVERSIONES:\n${investmentData}\n\nIMPUESTO ESTIMADO A PAGAR (Base del Ahorro): ${taxLiability.toFixed(2)}º`;

    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, temperature: 0.5 } });
    return response.text;
}, "No se pudo generar el consejo fiscal de inversiones.");

export const getSpecificTaxAdvice = async (
    simulationData: string,
    userQuery?: string
): Promise<string> => safeRun(async () => {
    const systemInstruction = `
    Eres un experto asesor fiscal de la Hacienda Pública Española (AEAT). Tu trabajo es analizar una simulación de impuestos detallada y proporcionar recomendaciones para optimizar la carga fiscal y gestionar la liquidez.

    Analiza los datos JSON proporcionados que contienen: Actividades económicas, Ingresos, Gastos, Resultados IRPF (General y Ahorro), IGIC/IVA, etc.

    Si el usuario hace una pregunta sobre falta de liquidez o cómo pagar, enfócate en:
    1.  **Fraccionamiento 60/40 (Modelo 100)**: Explica que es el método estándar sin intereses (60% en junio, 40% en noviembre).
    2.  **Solicitud de Aplazamiento**: Explica que se puede solicitar el pago en cuotas mensuales con intereses de demora si el fraccionamiento estándar no es suficiente.
    3.  **Préstamos Bancarios**: Menciona que existen líneas de crédito específicas para la renta.
    
    Si no hay pregunta, genera un análisis proactivo habitual:
    1. Identifica qué base imponible es la dominante (Trabajo vs Ahorro).
    2. Sugiere deducciones comunes (planes de pensiones, donaciones, deducciones autonómicas).
    3. Si hay actividad económica, sugiere optimización de gastos deducibles.
    
    Formato: Markdown claro y estructurado. Tono profesional pero accesible.
    `;

    const contentText = userQuery 
        ? `DATOS DE LA SIMULACIÓN:\n${simulationData}\n\nPREGUNTA DEL USUARIO:\n"${userQuery}"`
        : `DATOS DE LA SIMULACIÓN:\n${simulationData}\n\nPor favor, dame un análisis de optimización fiscal.`;

    const contents = [{ role: 'user', parts: [{ text: contentText }] }];

    const response = await ai.models.generateContent({ 
        model, 
        contents, 
        config: { systemInstruction, temperature: 0.5 } 
    });
    
    return response.text;
}, "No se pudo generar el consejo fiscal.");

export const getTaxChatResponse = async (
    userMessage: string,
    simulationContext: string,
    chatHistory: { role: string, parts: { text: string }[] }[]
) => safeRun(async () => {
    const systemInstruction = `
    Eres un chat fiscal inteligente integrado en una app de finanzas. Tienes acceso a los datos de la simulación fiscal ACTUAL del usuario.
    
    Tu objetivo es responder dudas sobre ESTA simulación específica.
    - NO inventes datos que no estén en el JSON.
    - Si te preguntan "¿Por qué pago tanto?", analiza las bases imponibles y las escalas.
    - Explica conceptos como "Cuota Íntegra" vs "Cuota Líquida" si es relevante.
    - Mantén las respuestas breves y directas.
    
    Datos de la simulación actual:
    ${simulationContext}
    `;

    const contents = [
        ...chatHistory,
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction, temperature: 0.6 }
    });

    return response.text;
}, "Error al conectar con el asistente fiscal.");
