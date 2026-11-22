"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import {
  Home,
  Dumbbell,
  Apple,
  TrendingUp,
  User,
  Check,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Flame,
  Droplets,
  Camera,
  ShoppingCart,
  FileText,
  Zap,
  Heart,
  Clock,
  Bell,
  Shield,
  Award,
  Activity,
  Timer,
  Users,
  Briefcase,
  PlayCircle,
  Search,
  Send,
  PlusCircle,
  CloudCheck,
  Utensils,
  Sparkles,
} from "lucide-react";

interface ExerciseSet {
  id: number;
  kg: string;
  reps: string;
  done: boolean;
}

interface Exercise {
  id: string;
  name: string;
  muscle: string;
  restSeconds: number;
  note: string;
  mediaUrl?: string;
  sets: ExerciseSet[];
}

interface RoutineDay {
  id: number;
  title: string;
  tag: string;
  exercisesCount: string;
  duration: string;
  exercises: Exercise[];
}

interface ClientProfile {
  id: string;
  name: string;
  goal: string;
  plan: string;
  kcalTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  dietPlan: string;
  compliance: number;
  coachNote: string;
}

export default function ApexHybridApp() {
  const [appMode, setAppMode] = useState<"athlete" | "coach">("athlete");
  const [coachSubTab, setCoachSubTab] = useState<"clientes" | "biblioteca" | "dieta" | "asignar">("clientes");
  const [dbConnected, setDbConnected] = useState<boolean>(false);

  // Estados Modo Atleta
  const [activeTab, setActiveTab] = useState<"hoy" | "entreno" | "dieta" | "progreso" | "perfil">("hoy");
  const [selectedDay, setSelectedDay] = useState("Mar");
  const [waterGlasses, setWaterGlasses] = useState(5);
  const [stepsToday, setStepsToday] = useState(6840);
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [openVideoExerciseId, setOpenVideoExerciseId] = useState<string | null>(null);
  const [openPrepMealId, setOpenPrepMealId] = useState<string | null>(null);

  // Estados Cámara y Análisis IA Escáner APEX
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [capturedPhoto, setCapturedPhoto] = useState<string>("");
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [aiWarning, setAiWarning] = useState<string>("");
  const [aiDetectedSummary, setAiDetectedSummary] = useState<string>("");

  const [scanKcal, setScanKcal] = useState<string>("0");
  const [scanProtein, setScanProtein] = useState<string>("0");
  const [scanCarbs, setScanCarbs] = useState<string>("0");
  const [scanFats, setScanFats] = useState<string>("0");

  const [extraScanKcal, setExtraScanKcal] = useState<number>(0);
  const [extraScanProtein, setExtraScanProtein] = useState<number>(0);
  const [extraScanCarbs, setExtraScanCarbs] = useState<number>(0);
  const [extraScanFats, setExtraScanFats] = useState<number>(0);
  const [scannerStatusMsg, setScannerStatusMsg] = useState<string>("");

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const startCameraScan = async () => {
    setCameraError("");
    setAiWarning("");
    setAiDetectedSummary("");
    setScannerStatusMsg("");
    setCapturedPhoto("");

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Tu navegador no soporta el acceso directo a la cámara en este dispositivo.");
      return;
    }

    try {
      stopCameraStream();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setIsCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador para este sitio."
          : "No se pudo abrir la cámara. Verifica que no esté en uso por otra app."
      );
    }
  };

  const capturePhotoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const rawW = video.videoWidth || 640;
    const rawH = video.videoHeight || 480;
    const maxWidth = 800;
    const scale = rawW > maxWidth ? maxWidth / rawW : 1;

    const width = Math.round(rawW * scale);
    const height = Math.round(rawH * scale);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      setCapturedPhoto(dataUrl);
      setAiWarning("");
      setAiDetectedSummary("");
      setScannerStatusMsg("");
    }
    stopCameraStream();
  };

  const analyzePhotoWithAI = async () => {
    if (!capturedPhoto) return;
    setIsAnalyzingAI(true);
    setAiWarning("");
    setAiDetectedSummary("");
    setScannerStatusMsg("");

    try {
      const res = await fetch("/api/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: capturedPhoto }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiWarning(data?.error || "No se pudo analizar la imagen con IA.");
        return;
      }

      if (!data.is_food) {
        setScanKcal("0");
        setScanProtein("0");
        setScanCarbs("0");
        setScanFats("0");
        setAiWarning(
          `No se detectó comida ni etiqueta nutricional en la imagen (${data.summary || "objeto no alimentario"}). Los macros se dejaron en 0.`
        );
        return;
      }

      setScanKcal(String(data.calories ?? 0));
      setScanProtein(String(data.protein_g ?? 0));
      setScanCarbs(String(data.carbs_g ?? 0));
      setScanFats(String(data.fats_g ?? 0));
      setAiDetectedSummary(data.summary || "Alimento o etiqueta detectada");
    } catch {
      setAiWarning("Error de conexión al contactar con el analizador IA.");
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const applyScannedMacros = (e: React.FormEvent) => {
    e.preventDefault();
    const k = Number(scanKcal) || 0;
    const p = Number(scanProtein) || 0;
    const c = Number(scanCarbs) || 0;
    const f = Number(scanFats) || 0;

    if (k === 0 && p === 0 && c === 0 && f === 0) {
      setAiWarning("No hay calorías ni macros para sumar (valores en 0).");
      return;
    }

    setExtraScanKcal((prev) => prev + k);
    setExtraScanProtein((prev) => prev + p);
    setExtraScanCarbs((prev) => prev + c);
    setExtraScanFats((prev) => prev + f);
    setScannerStatusMsg(`Añadidos +${k} kcal (${p}g P · ${c}g C · ${f}g G) al registro de hoy.`);
    setCapturedPhoto("");
    setAiDetectedSummary("");
    setAiWarning("");
    setScanKcal("0");
    setScanProtein("0");
    setScanCarbs("0");
    setScanFats("0");
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Temporizador de descanso
  const [restTimeLeft, setRestTimeLeft] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!isTimerRunning || restTimeLeft <= 0) {
      if (restTimeLeft === 0) setIsTimerRunning(false);
      return;
    }
    const interval = setInterval(() => {
      setRestTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, restTimeLeft]);

  const startRestTimer = (seconds: number) => {
    setRestTimeLeft(seconds);
    setIsTimerRunning(true);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  // Clientes cargados desde Supabase
  const [clients, setClients] = useState<ClientProfile[]>([
    {
      id: "c1",
      name: "Gustavo Prado (Demo)",
      goal: "Recomposición & Fuerza Híbrida",
      plan: "APEX Pro · Mensual",
      kcalTarget: 2300,
      proteinTarget: 185,
      carbsTarget: 235,
      fatsTarget: 68,
      dietPlan: "",
      compliance: 92,
      coachNote: "Cargando directivas desde la nube...",
    },
  ]);

  const [selectedClientId, setSelectedClientId] = useState<string>("c1");
  const activeClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  // Formularios del Panel de Coach
  const [newClientName, setNewClientName] = useState("");
  const [newClientGoal, setNewClientGoal] = useState("");
  const [newClientKcal, setNewClientKcal] = useState("2200");

  const [newExName, setNewExName] = useState("");
  const [newExMuscle, setNewExMuscle] = useState("Pectoral");
  const [newExRest, setNewExRest] = useState("90");
  const [newExNote, setNewExNote] = useState("");
  const [newExMedia, setNewExMedia] = useState("");
  const [targetRoutineForNewEx, setTargetRoutineForNewEx] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [coachDirectiveDraft, setCoachDirectiveDraft] = useState("");

  // Borrador de prescripción de dieta en Modo Coach
  const [dietKcalDraft, setDietKcalDraft] = useState("2300");
  const [dietProteinDraft, setDietProteinDraft] = useState("185");
  const [dietCarbsDraft, setDietCarbsDraft] = useState("235");
  const [dietFatsDraft, setDietFatsDraft] = useState("68");
  const [dietPlanDraft, setDietPlanDraft] = useState("");

  const syncDietDraftWithClient = (client: ClientProfile) => {
    setDietKcalDraft(String(client.kcalTarget || 2200));
    setDietProteinDraft(String(client.proteinTarget || 180));
    setDietCarbsDraft(String(client.carbsTarget || 220));
    setDietFatsDraft(String(client.fatsTarget || 65));
    setDietPlanDraft(client.dietPlan || "");
  };

  const [completedMeals, setCompletedMeals] = useState<Record<string, boolean>>({
    desayuno: true,
    mediamanana: true,
    comida: false,
    merienda: false,
    cena: false,
  });

  const [completedSupps, setCompletedSupps] = useState<Record<string, boolean>>({
    whey: true,
    creatina: true,
    cafeina: false,
    omega3: false,
    vitd3: false,
    magnesio: false,
  });

  const [completedWorkouts, setCompletedWorkouts] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
    5: false,
  });

  const [routinesData, setRoutinesData] = useState<RoutineDay[]>([
    {
      id: 1,
      title: "Día 1 · Pecho y Tríceps",
      tag: "FUERZA",
      exercisesCount: "4 ejercicios · Pecho, Tríceps",
      duration: "~55 min",
      exercises: [
        {
          id: "e1",
          name: "Press de Banca Plano con Barra",
          muscle: "Pectoral Mayor",
          restSeconds: 120,
          note: "Bajada controlada en 2 seg, pausa breve en pecho y empuje explosivo.",
          mediaUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80",
          sets: [
            { id: 1, kg: "80", reps: "8", done: true },
            { id: 2, kg: "85", reps: "6", done: true },
            { id: 3, kg: "85", reps: "6", done: true },
            { id: 4, kg: "80", reps: "8", done: true },
          ],
        },
        {
          id: "e2",
          name: "Press Inclinado con Mancuernas (30°)",
          muscle: "Pectoral Superior",
          restSeconds: 90,
          note: "Codos ligeramente metidos hacia adentro, máximo estiramiento abajo.",
          mediaUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&q=80",
          sets: [
            { id: 1, kg: "30", reps: "10", done: true },
            { id: 2, kg: "30", reps: "10", done: true },
            { id: 3, kg: "32", reps: "8", done: true },
          ],
        },
        {
          id: "e3",
          name: "Cruce de Poleas Altas",
          muscle: "Pectoral",
          restSeconds: 60,
          note: "Aprieta 1 segundo al juntar las manos al frente.",
          sets: [
            { id: 1, kg: "20", reps: "12", done: true },
            { id: 2, kg: "20", reps: "12", done: true },
            { id: 3, kg: "22.5", reps: "10", done: true },
          ],
        },
        {
          id: "e4",
          name: "Extensión de Tríceps en Polea con Cuerda",
          muscle: "Tríceps",
          restSeconds: 60,
          note: "Mantén los codos pegados al torso sin balancear el cuerpo.",
          sets: [
            { id: 1, kg: "25", reps: "12", done: true },
            { id: 2, kg: "27.5", reps: "12", done: true },
            { id: 3, kg: "30", reps: "10", done: true },
          ],
        },
      ],
    },
    {
      id: 2,
      title: "Día 2 · Espalda y Bíceps",
      tag: "FUERZA",
      exercisesCount: "4 ejercicios · Espalda, Bíceps",
      duration: "~60 min",
      exercises: [
        {
          id: "b1",
          name: "Dominadas Lastradas (Agarre Prono)",
          muscle: "Dorsal Ancho",
          restSeconds: 120,
          note: "Pecho hacia la barra, controla el descenso hasta extender brazos.",
          mediaUrl: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&q=80",
          sets: [
            { id: 1, kg: "10", reps: "8", done: true },
            { id: 2, kg: "10", reps: "8", done: false },
            { id: 3, kg: "12.5", reps: "6", done: false },
            { id: 4, kg: "0", reps: "10", done: false },
          ],
        },
        {
          id: "b2",
          name: "Remo con Barra Pendlay / Inclinado",
          muscle: "Espalda Media",
          restSeconds: 90,
          note: "Espalda neutra, lleva la barra hacia la boca del estómago.",
          sets: [
            { id: 1, kg: "70", reps: "10", done: false },
            { id: 2, kg: "75", reps: "8", done: false },
            { id: 3, kg: "75", reps: "8", done: false },
          ],
        },
        {
          id: "b3",
          name: "Jalón al Pecho Agarre Neutro",
          muscle: "Dorsal",
          restSeconds: 75,
          note: "Inicia el movimiento deprimiendo escápulas.",
          sets: [
            { id: 1, kg: "60", reps: "12", done: false },
            { id: 2, kg: "65", reps: "10", done: false },
            { id: 3, kg: "65", reps: "10", done: false },
          ],
        },
        {
          id: "b4",
          name: "Curl de Bíceps con Barra Z",
          muscle: "Bíceps",
          restSeconds: 60,
          note: "Sin impulso lumbar, sube explosivo y baja en 2 segundos.",
          sets: [
            { id: 1, kg: "30", reps: "10", done: false },
            { id: 2, kg: "32.5", reps: "10", done: false },
            { id: 3, kg: "35", reps: "8", done: false },
          ],
        },
      ],
    },
    {
      id: 3,
      title: "Día 3 · Pierna Completa",
      tag: "FUERZA",
      exercisesCount: "4 ejercicios · Cuádriceps, Femoral",
      duration: "~65 min",
      exercises: [
        {
          id: "p1",
          name: "Sentadilla Libre con Barra",
          muscle: "Cuádriceps y Glúteo",
          restSeconds: 150,
          note: "Rompe el paralelo manteniendo el core firme y rodillas alineadas.",
          mediaUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80",
          sets: [
            { id: 1, kg: "100", reps: "8", done: false },
            { id: 2, kg: "110", reps: "6", done: false },
            { id: 3, kg: "115", reps: "6", done: false },
            { id: 4, kg: "100", reps: "8", done: false },
          ],
        },
        {
          id: "p2",
          name: "Peso Muerto Rumano con Barra",
          muscle: "Isquiosurales",
          restSeconds: 120,
          note: "Empuja la cadera atrás hasta sentir máxima tensión en femorales.",
          sets: [
            { id: 1, kg: "90", reps: "10", done: false },
            { id: 2, kg: "100", reps: "8", done: false },
            { id: 3, kg: "100", reps: "8", done: false },
          ],
        },
        {
          id: "p3",
          name: "Prensa Inclinada 45°",
          muscle: "Cuádriceps",
          restSeconds: 90,
          note: "Pies a la anchura de hombros, no bloquees rodillas arriba.",
          sets: [
            { id: 1, kg: "180", reps: "12", done: false },
            { id: 2, kg: "200", reps: "10", done: false },
            { id: 3, kg: "200", reps: "10", done: false },
          ],
        },
        {
          id: "p4",
          name: "Elevación de Talones de Pie",
          muscle: "Gemelos",
          restSeconds: 60,
          note: "Pausa de 1 segundo abajo y máxima contracción arriba.",
          sets: [
            { id: 1, kg: "70", reps: "15", done: false },
            { id: 2, kg: "70", reps: "15", done: false },
            { id: 3, kg: "75", reps: "12", done: false },
          ],
        },
      ],
    },
    {
      id: 4,
      title: "Día 4 · Hombro y Core",
      tag: "ESTABILIDAD",
      exercisesCount: "3 ejercicios · Deltoides, Abdomen",
      duration: "~50 min",
      exercises: [
        {
          id: "h1",
          name: "Press Militar de Pie con Barra",
          muscle: "Deltoides Anterior",
          restSeconds: 120,
          note: "Glúteos y abdomen apretados para proteger zona lumbar.",
          sets: [
            { id: 1, kg: "50", reps: "8", done: false },
            { id: 2, kg: "52.5", reps: "6", done: false },
            { id: 3, kg: "52.5", reps: "6", done: false },
          ],
        },
        {
          id: "h2",
          name: "Elevaciones Laterales con Mancuernas",
          muscle: "Deltoides Lateral",
          restSeconds: 60,
          note: "Sube hasta la altura de los hombros liderando con los codos.",
          sets: [
            { id: 1, kg: "12", reps: "15", done: false },
            { id: 2, kg: "14", reps: "12", done: false },
            { id: 3, kg: "14", reps: "12", done: false },
          ],
        },
        {
          id: "h3",
          name: "Elevación de Piernas Colgado en Barra",
          muscle: "Core / Recto Abdominal",
          restSeconds: 60,
          note: "Evita balancearte, sube la pelvis hacia el pecho.",
          sets: [
            { id: 1, kg: "0", reps: "15", done: false },
            { id: 2, kg: "0", reps: "15", done: false },
            { id: 3, kg: "0", reps: "12", done: false },
          ],
        },
      ],
    },
    {
      id: 5,
      title: "Día 5 · Híbrido + Zona 2",
      tag: "RESISTENCIA",
      exercisesCount: "2 bloques · Kettlebell, Running",
      duration: "~55 min",
      exercises: [
        {
          id: "hy1",
          name: "Kettlebell Swings (Potencia Cadera)",
          muscle: "Cadena Posterior",
          restSeconds: 60,
          note: "Golpe explosivo de cadera, brazos actúan solo como cuerdas.",
          sets: [
            { id: 1, kg: "24", reps: "20", done: false },
            { id: 2, kg: "24", reps: "20", done: false },
            { id: 3, kg: "24", reps: "20", done: false },
          ],
        },
        {
          id: "hy2",
          name: "Carrera Continua Zona 2 (Ritmo Aeróbico)",
          muscle: "Sistema Cardiovascular",
          restSeconds: 60,
          note: "Mantén pulsaciones entre 135-150 lpm, respiración nasal controlada.",
          sets: [{ id: 1, kg: "0", reps: "30 min", done: false }],
        },
      ],
    },
  ]);

  // CARGAR CLIENTES Y EJERCICIOS DESDE SUPABASE AL ABRIR LA APP
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const { data: clientsData, error: clientsErr } = await supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });

        if (!clientsErr && clientsData && clientsData.length > 0) {
          const mappedClients: ClientProfile[] = clientsData.map((c: any) => ({
            id: c.id,
            name: c.name,
            goal: c.goal,
            plan: c.plan || "APEX Pro · Mensual",
            kcalTarget: c.kcal_target || 2200,
            proteinTarget: c.protein_g || 185,
            carbsTarget: c.carbs_g || 235,
            fatsTarget: c.fats_g || 68,
            dietPlan: c.diet_plan || "",
            compliance: c.compliance || 100,
            coachNote: c.coach_note || "",
          }));
          setClients(mappedClients);
          setSelectedClientId(mappedClients[0].id);
          setCoachDirectiveDraft(mappedClients[0].coachNote);
          syncDietDraftWithClient(mappedClients[0]);
          setDbConnected(true);
        }

        const { data: exData, error: exErr } = await supabase
          .from("exercises")
          .select("*")
          .order("created_at", { ascending: true });

        if (!exErr && exData && exData.length > 0) {
          setRoutinesData((prev) =>
            prev.map((r) => {
              const extraForDay = exData
                .filter((e: any) => e.routine_day === r.id)
                .map((e: any) => ({
                  id: e.id,
                  name: e.name,
                  muscle: e.muscle,
                  restSeconds: e.rest_seconds || 90,
                  note: e.note || "Ejecución controlada manteniendo técnica estricta.",
                  mediaUrl: e.media_url || undefined,
                  sets: [
                    { id: 1, kg: "20", reps: "12", done: false },
                    { id: 2, kg: "20", reps: "10", done: false },
                    { id: 3, kg: "20", reps: "10", done: false },
                  ],
                }));
              if (extraForDay.length === 0) return r;
              const combined = [...r.exercises, ...extraForDay];
              return {
                ...r,
                exercisesCount: `${combined.length} ejercicios · Sincronizado`,
                exercises: combined,
              };
            })
          );
        }
      } catch (err) {
        console.error("Error conectando con Supabase:", err);
      }
    }
    loadFromSupabase();
  }, []);

  const [expandedMeal, setExpandedMeal] = useState<string | null>("desayuno");
  const [checkedGroceries, setCheckedGroceries] = useState<Record<string, boolean>>({});
  const [selectedSupermarket, setSelectedSupermarket] = useState("Mercadona");

  const days = [
    { short: "Lun", done: true },
    { short: "Mar", done: false, active: true },
    { short: "Mié", done: false },
    { short: "Jue", done: false },
    { short: "Vie", done: false },
    { short: "Sáb", done: false },
    { short: "Dom", done: false },
  ];

  const meals = [
    {
      id: "desayuno",
      name: "Desayuno",
      time: "08:00",
      kcal: 581,
      protein: 30,
      carbs: 63,
      fats: 24,
      summary: "Yogur griego natural · Copos de avena...",
      prep: "Mezcla 200 g de yogur griego natural con 50 g de avena, añade 80 g de arándanos y 20 g de almendras troceadas, y corona con 10 g de miel.",
      items: [
        { name: "Yogur griego natural", detail: "200 g · 18g P · 8g C · 10g G", kcal: 194 },
        { name: "Copos de avena", detail: "50 g · 7g P · 33g C · 4g G", kcal: 195 },
        { name: "Arándanos", detail: "80 g · 1g P · 11g C · 0g G", kcal: 46 },
        { name: "Almendras", detail: "20 g · 4g P · 4g C · 10g G", kcal: 116 },
        { name: "Miel", detail: "10 g · 0g P · 8g C · 0g G", kcal: 30 },
      ],
    },
    {
      id: "mediamanana",
      name: "Media mañana",
      time: "11:30",
      kcal: 238,
      protein: 24,
      carbs: 29,
      fats: 2,
      summary: "Pan integral · Pechuga de pavo...",
      prep: "Tuesta 60 g de pan integral y rellénalo con 80 g de pechuga de pavo en lonchas.",
      items: [
        { name: "Pan integral", detail: "60 g · 6g P · 28g C · 1g G", kcal: 148 },
        { name: "Pechuga de pavo", detail: "80 g · 18g P · 1g C · 1g G", kcal: 90 },
      ],
    },
    {
      id: "comida",
      name: "Comida",
      time: "14:00",
      kcal: 651,
      protein: 49,
      carbs: 60,
      fats: 22,
      summary: "Ternera magra · Patata · Espinaca...",
      prep: "Cocina 200 g de ternera magra a la plancha, acompaña con 350 g de patata cocida y aliña en crudo con 10 g de aceite de oliva virgen extra.",
      items: [
        { name: "Ternera magra", detail: "200 g · 42g P · 0g C · 12g G", kcal: 280 },
        { name: "Patata cocida", detail: "350 g · 7g P · 60g C · 0g G", kcal: 270 },
        { name: "Aceite de oliva virgen", detail: "10 g · 0g P · 0g C · 10g G", kcal: 90 },
      ],
    },
    {
      id: "merienda",
      name: "Merienda",
      time: "18:00",
      kcal: 209,
      protein: 25,
      carbs: 23,
      fats: 1,
      summary: "Batido de proteína · Plátano",
      prep: "Agita 30 g de proteína Whey con agua o bebida vegetal y acompaña con 100 g de plátano.",
      items: [
        { name: "Proteína Whey", detail: "30 g · 24g P · 2g C · 1g G", kcal: 119 },
        { name: "Plátano", detail: "100 g · 1g P · 21g C · 0g G", kcal: 90 },
      ],
    },
    {
      id: "cena",
      name: "Cena",
      time: "21:00",
      kcal: 502,
      protein: 63,
      carbs: 42,
      fats: 6,
      summary: "Pechuga de pavo · Lentejas cocidas...",
      prep: "Haz 200 g de pechuga de pavo a la plancha y sírvela junto a 220 g de lentejas cocidas escurridas y templadas.",
      items: [
        { name: "Pechuga de pavo a la plancha", detail: "200 g · 44g P · 0g C · 4g G", kcal: 220 },
        { name: "Lentejas cocidas", detail: "220 g · 19g P · 42g C · 2g G", kcal: 282 },
      ],
    },
  ];

  const supplements = [
    {
      id: "whey",
      name: "Proteína whey",
      dose: "30 g",
      brand: "HSN Evowhey",
      timing: "Post-entreno",
      note: "Con agua o leche. Sirve para llegar a tu objetivo de proteína del día.",
      icon: "check",
    },
    {
      id: "creatina",
      name: "Creatina monohidrato",
      dose: "5 g",
      brand: "Creapure",
      timing: "Cualquier hora",
      note: "A diario, también los días de descanso. La constancia es lo que cuenta.",
      icon: "check",
    },
    {
      id: "cafeina",
      name: "Cafeína",
      dose: "200 mg",
      brand: "Prozis",
      timing: "Pre-entreno",
      note: "30-40 min antes de entrenar. No la tomes pasadas las 17:00.",
      icon: "bolt",
    },
    {
      id: "omega3",
      name: "Omega-3",
      dose: "2 g EPA+DHA",
      brand: "Nordic Naturals",
      timing: "Con la comida",
      note: "Salud cardiovascular y articular.",
      icon: "heart",
    },
    {
      id: "vitd3",
      name: "Vitamina D3",
      dose: "2.000 UI",
      brand: "NOW Foods",
      timing: "Con el desayuno",
      note: "Especialmente en invierno o si entrenas en interior.",
      icon: "heart",
    },
    {
      id: "magnesio",
      name: "Magnesio",
      dose: "300 mg",
      brand: "Ana Maria Lajusticia",
      timing: "Noche",
      note: "Ayuda al descanso y a reducir calambres.",
      icon: "heart",
    },
  ];

  const groceryItems = [
    { id: "platano", name: "1× Plátano de Canarias", detail: "malla 1 kg · para plátano (desayunos y meriendas)" },
    { id: "manzana", name: "1× Manzana Gala", detail: "malla 1 kg · para manzana (media mañana)" },
    { id: "arandanos", name: "2× Arándanos", detail: "tarrina 250 g · para arándanos (desayunos y meriendas)" },
    { id: "aguacate", name: "2× Aguacate", detail: "unidad · para aguacate (cenas)" },
  ];

  const completedMealsCount = Object.values(completedMeals).filter(Boolean).length;
  const completedSuppsCount = Object.values(completedSupps).filter(Boolean).length;
  const consumedKcal =
    meals.reduce((acc, m) => (completedMeals[m.id] ? acc + m.kcal : acc), 0) + extraScanKcal;
  const consumedProtein =
    meals.reduce((acc, m) => (completedMeals[m.id] ? acc + m.protein : acc), 0) + extraScanProtein;
  const consumedCarbs =
    meals.reduce((acc, m) => (completedMeals[m.id] ? acc + m.carbs : acc), 0) + extraScanCarbs;
  const consumedFats =
    meals.reduce((acc, m) => (completedMeals[m.id] ? acc + m.fats : acc), 0) + extraScanFats;

  const targetKcal = activeClient.kcalTarget || 2200;
  const targetProtein = activeClient.proteinTarget || 185;
  const targetCarbs = activeClient.carbsTarget || 235;
  const targetFats = activeClient.fatsTarget || 68;
  const remainingKcal = Math.max(0, targetKcal - consumedKcal);
  const kcalPercent = Math.min(100, Math.round((consumedKcal / targetKcal) * 100));

  const shareMealsWhatsApp = () => {
    const lines = meals.map(
      (m) => `${completedMeals[m.id] ? "✅" : "⬜"} ${m.name} (${m.time}) - ${m.kcal} kcal: ${m.summary}`
    );
    const text = `📋 *Plan Nutricional APEX HYBRID · ${activeClient.name}*\n🔥 Objetivo: ${targetKcal} kcal (${consumedKcal} kcal hoy)\n🥩 Macros: ${consumedProtein}/${targetProtein}g P · ${consumedCarbs}/${targetCarbs}g C · ${consumedFats}/${targetFats}g G\n\n${lines.join("\n")}${
      activeClient.dietPlan ? `\n\n📝 *Pauta Coach:*\n${activeClient.dietPlan}` : ""
    }`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareGroceryWhatsApp = () => {
    const lines = groceryItems.map(
      (g) => `${checkedGroceries[g.id] ? "✅" : "⬜"} ${g.name} (${g.detail})`
    );
    const text = `🛒 *Lista de la Compra (${selectedSupermarket}) · APEX HYBRID*\n\n${lines.join("\n")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const exportPdfView = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const toggleMeal = (id: string) => {
    setCompletedMeals((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSupp = (id: string) => {
    setCompletedSupps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSetField = (routineId: number, exerciseId: string, setId: number, field: "kg" | "reps", value: string) => {
    setRoutinesData((prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          exercises: r.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            };
          }),
        };
      })
    );
  };

  const toggleSetDone = (routineId: number, exerciseId: string, setId: number, restSeconds: number) => {
    setRoutinesData((prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          exercises: r.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.id !== setId) return s;
                const nextDone = !s.done;
                if (nextDone) startRestTimer(restSeconds);
                return { ...s, done: nextDone };
              }),
            };
          }),
        };
      })
    );
  };

  // GUARDAR NUEVO CLIENTE EN SUPABASE
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const payload = {
      name: newClientName.trim(),
      goal: newClientGoal.trim() || "Acondicionamiento Híbrido",
      plan: "APEX Pro · Mensual",
      kcal_target: Number(newClientKcal) || 2200,
      protein_g: 185,
      carbs_g: 235,
      fats_g: 68,
      diet_plan: "",
      compliance: 100,
      coach_note: "Bienvenido a APEX HYBRID. Mantén constancia en tus registros diarios.",
    };

    const { data, error } = await supabase.from("clients").insert([payload]).select().single();

    if (!error && data) {
      const created: ClientProfile = {
        id: data.id,
        name: data.name,
        goal: data.goal,
        plan: data.plan,
        kcalTarget: data.kcal_target,
        proteinTarget: data.protein_g || 185,
        carbsTarget: data.carbs_g || 235,
        fatsTarget: data.fats_g || 68,
        dietPlan: data.diet_plan || "",
        compliance: data.compliance,
        coachNote: data.coach_note,
      };
      setClients((prev) => [created, ...prev]);
      setSelectedClientId(created.id);
      syncDietDraftWithClient(created);
      setNewClientName("");
      setNewClientGoal("");
      alert(`¡Cliente "${created.name}" guardado en Supabase!`);
    } else {
      alert("Error al guardar cliente: " + error?.message);
    }
  };

  // GUARDAR NUEVO EJERCICIO EN SUPABASE
  const handleAddExerciseToRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;

    const payload = {
      routine_day: targetRoutineForNewEx,
      name: newExName.trim(),
      muscle: newExMuscle.trim() || "General",
      rest_seconds: Number(newExRest) || 90,
      note: newExNote.trim() || "Ejecución controlada manteniendo técnica estricta.",
      media_url:
        newExMedia.trim() ||
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    };

    const { data, error } = await supabase.from("exercises").insert([payload]).select().single();

    if (!error && data) {
      const newExercise: Exercise = {
        id: data.id,
        name: data.name,
        muscle: data.muscle,
        restSeconds: data.rest_seconds,
        note: data.note,
        mediaUrl: data.media_url,
        sets: [
          { id: 1, kg: "20", reps: "12", done: false },
          { id: 2, kg: "20", reps: "10", done: false },
          { id: 3, kg: "20", reps: "10", done: false },
        ],
      };

      setRoutinesData((prev) =>
        prev.map((r) => {
          if (r.id !== targetRoutineForNewEx) return r;
          const updatedExercises = [...r.exercises, newExercise];
          return {
            ...r,
            exercisesCount: `${updatedExercises.length} ejercicios · Sincronizado`,
            exercises: updatedExercises,
          };
        })
      );

      setNewExName("");
      setNewExNote("");
      setNewExMedia("");
      alert(`¡Ejercicio guardado en la nube y añadido al Día ${targetRoutineForNewEx}!`);
    } else {
      alert("Error al guardar ejercicio: " + error?.message);
    }
  };

  // PRESCRIBIR / GUARDAR DIETA EN SUPABASE
  const handleSaveDietPrescription = async (e: React.FormEvent) => {
    e.preventDefault();

    const kcalVal = Number(dietKcalDraft) || 2200;
    const protVal = Number(dietProteinDraft) || 0;
    const carbsVal = Number(dietCarbsDraft) || 0;
    const fatsVal = Number(dietFatsDraft) || 0;
    const planText = dietPlanDraft.trim();

    const { error } = await supabase
      .from("clients")
      .update({
        kcal_target: kcalVal,
        protein_g: protVal,
        carbs_g: carbsVal,
        fats_g: fatsVal,
        diet_plan: planText,
      })
      .eq("id", selectedClientId);

    if (!error) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClientId
            ? {
                ...c,
                kcalTarget: kcalVal,
                proteinTarget: protVal,
                carbsTarget: carbsVal,
                fatsTarget: fatsVal,
                dietPlan: planText,
              }
            : c
        )
      );
      alert(`¡Dieta prescrita y guardada en la nube para ${activeClient.name}!`);
    } else {
      alert("Error al guardar dieta: " + error.message);
    }
  };

  // ACTUALIZAR DIRECTIVA EN SUPABASE
  const handleUpdateCoachNote = async () => {
    const { error } = await supabase
      .from("clients")
      .update({ coach_note: coachDirectiveDraft })
      .eq("id", selectedClientId);

    if (!error) {
      setClients((prev) =>
        prev.map((c) => (c.id === selectedClientId ? { ...c, coachNote: coachDirectiveDraft } : c))
      );
      alert(`Directiva guardada en la nube para ${activeClient.name}.`);
    } else {
      alert("Error al actualizar directiva: " + error.message);
    }
  };

  const allExercisesFlat = routinesData.flatMap((r) =>
    r.exercises.map((ex) => ({ ...ex, dayTitle: r.title }))
  );
  const filteredExercises = allExercisesFlat.filter(
    (ex) =>
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.muscle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeRoutine = routinesData.find((r) => r.id === selectedRoutineId) || null;

  return (
    <div className="min-h-screen bg-[#070809] text-white font-sans flex justify-center selection:bg-[#4DF500] selection:text-black">
      <div className="w-full max-w-md bg-[#090A0B] min-h-screen flex flex-col relative pb-28 border-x border-zinc-900">
        
        {/* CABECERA OFICIAL APEX HYBRID */}
        <header className="bg-[#090A0B]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#121417] border border-zinc-700/80 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(77,245,0,0.18)]">
              <img
                src="/logo.jpg"
                alt="APEX HYBRID Logo"
                className="w-full h-full object-cover scale-125"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <div className="tracking-wider font-black text-base leading-none">
                  <span className="text-white">APEX </span>
                  <span className="text-[#4DF500]">HYBRI</span>
                  <span className="text-zinc-400">D</span>
                </div>
                {dbConnected && (
                  <span title="Conectado a Supabase" className="w-2 h-2 rounded-full bg-[#4DF500]" />
                )}
              </div>
              <p className="text-[8px] font-bold tracking-[0.12em] text-zinc-400 uppercase mt-1">
                Fuerza, Resistencia y Disciplina
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCameraStream();
              setAppMode(appMode === "athlete" ? "coach" : "athlete");
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 border transition ${
              appMode === "coach"
                ? "bg-[#4DF500] text-black border-[#4DF500] shadow-[0_0_15px_rgba(77,245,0,0.3)]"
                : "bg-[#121417] text-zinc-200 border-zinc-700 hover:border-[#4DF500]"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            {appMode === "coach" ? "Panel Coach" : "Modo Coach"}
          </button>
        </header>

        {/* ===================================================================== */}
        {/* ==================== VISTA PANEL DE COACH (NEGOCIO) ================= */}
        {/* ===================================================================== */}
        {appMode === "coach" ? (
          <div className="px-4 pt-5 space-y-5 flex-1">
            <div className="bg-gradient-to-r from-[#172115] to-[#121417] border border-[#4DF500]/40 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#4DF500] flex items-center gap-1">
                  <CloudCheck className="w-3.5 h-3.5" /> Nube Sincronizada
                </span>
                <h1 className="text-lg font-extrabold mt-0.5">Panel de Entrenador</h1>
                <p className="text-xs text-zinc-400">
                  Atleta activo: <strong className="text-zinc-200">{activeClient.name}</strong>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[#4DF500]">{clients.length}</p>
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Activos</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-[#121417] p-1.5 rounded-2xl border border-zinc-800">
              {[
                { id: "clientes", label: "Clientes", icon: Users },
                { id: "biblioteca", label: "Ejercicios", icon: Dumbbell },
                { id: "dieta", label: "Dieta", icon: Utensils },
                { id: "asignar", label: "Directivas", icon: Send },
              ].map((t) => {
                const Icon = t.icon;
                const active = coachSubTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setCoachSubTab(t.id as any)}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition ${
                      active ? "bg-[#4DF500] text-black" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {coachSubTab === "clientes" && (
              <div className="space-y-4">
                <form
                  onSubmit={handleAddClient}
                  className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#4DF500] flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" /> Registrar Nuevo Cliente
                  </h2>
                  <input
                    type="text"
                    placeholder="Nombre completo del alumno (ej. Luis Pérez)"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Objetivo (ej. Definición)"
                      value={newClientGoal}
                      onChange={(e) => setNewClientGoal(e.target.value)}
                      className="col-span-2 bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                    <input
                      type="number"
                      placeholder="Kcal"
                      value={newClientKcal}
                      onChange={(e) => setNewClientKcal(e.target.value)}
                      className="bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#4DF500] text-black font-extrabold text-xs py-2.5 rounded-xl hover:bg-[#43d900] transition"
                  >
                    Crear Cuenta de Atleta en la Nube
                  </button>
                </form>

                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Cartera de Clientes ({clients.length})
                  </h3>
                  {clients.map((client) => {
                    const isSelected = client.id === selectedClientId;
                    return (
                      <div
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setCoachDirectiveDraft(client.coachNote);
                          syncDietDraftWithClient(client);
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                          isSelected
                            ? "bg-[#151A14] border-[#4DF500]"
                            : "bg-[#121417] border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-extrabold text-sm text-white">{client.name}</h4>
                            <p className="text-xs text-zinc-400">{client.goal}</p>
                          </div>
                          <span className="text-[10px] font-extrabold bg-[#4DF500]/15 text-[#4DF500] px-2.5 py-1 rounded-lg">
                            {client.compliance}% adherencia
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                          <span>{client.plan}</span>
                          <span className="font-bold text-zinc-200">{client.kcalTarget} kcal/día</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {coachSubTab === "biblioteca" && (
              <div className="space-y-4">
                <form
                  onSubmit={handleAddExerciseToRoutine}
                  className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#4DF500] flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" /> Crear y Guardar Nuevo Ejercicio
                  </h2>
                  <input
                    type="text"
                    placeholder="Nombre del ejercicio (ej. Remo en Punta)"
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Músculo (ej. Dorsal)"
                      value={newExMuscle}
                      onChange={(e) => setNewExMuscle(e.target.value)}
                      className="bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                    <select
                      value={targetRoutineForNewEx}
                      onChange={(e) => setTargetRoutineForNewEx(Number(e.target.value))}
                      className="bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    >
                      {routinesData.map((r) => (
                        <option key={r.id} value={r.id}>
                          Añadir a {r.title.split("·")[0]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="URL de imagen o video demostrativo (opcional)"
                    value={newExMedia}
                    onChange={(e) => setNewExMedia(e.target.value)}
                    className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                  />
                  <input
                    type="text"
                    placeholder="Indicación técnica para el cliente..."
                    value={newExNote}
                    onChange={(e) => setNewExNote(e.target.value)}
                    className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                  />
                  <button
                    type="submit"
                    className="w-full bg-[#4DF500] text-black font-extrabold text-xs py-2.5 rounded-xl"
                  >
                    Guardar en Supabase y Rutina
                  </button>
                </form>

                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar ejercicio en tu biblioteca..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#121417] border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                  </div>

                  {filteredExercises.map((ex) => (
                    <div
                      key={ex.id}
                      className="bg-[#121417] border border-zinc-800 rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#1A1D22] overflow-hidden shrink-0 flex items-center justify-center border border-zinc-700">
                        {ex.mediaUrl ? (
                          <img src={ex.mediaUrl} alt={ex.name} className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-[#4DF500]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{ex.name}</p>
                        <p className="text-[11px] text-zinc-400">
                          {ex.muscle} · <span className="text-[#4DF500]">{ex.dayTitle.split("·")[0]}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coachSubTab === "dieta" && (
              <form
                onSubmit={handleSaveDietPrescription}
                className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-4"
              >
                <div>
                  <h2 className="text-sm font-extrabold text-[#4DF500] flex items-center gap-1.5">
                    <Utensils className="w-4 h-4" /> Prescribir Dieta y Macros
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configura los objetivos y comidas para <strong className="text-white">{activeClient.name}</strong>.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                    Seleccionar Atleta
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedClientId(nextId);
                      const found = clients.find((c) => c.id === nextId);
                      if (found) {
                        setCoachDirectiveDraft(found.coachNote);
                        syncDietDraftWithClient(found);
                      }
                    }}
                    className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.kcalTarget} kcal)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                      Calorías (kcal/día)
                    </label>
                    <input
                      type="number"
                      value={dietKcalDraft}
                      onChange={(e) => setDietKcalDraft(e.target.value)}
                      className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                      Proteína (g)
                    </label>
                    <input
                      type="number"
                      value={dietProteinDraft}
                      onChange={(e) => setDietProteinDraft(e.target.value)}
                      className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                      Carbohidratos (g)
                    </label>
                    <input
                      type="number"
                      value={dietCarbsDraft}
                      onChange={(e) => setDietCarbsDraft(e.target.value)}
                      className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                      Grasas (g)
                    </label>
                    <input
                      type="number"
                      value={dietFatsDraft}
                      onChange={(e) => setDietFatsDraft(e.target.value)}
                      className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                    Pauta de Comidas / Plan Nutricional
                  </label>
                  <textarea
                    rows={6}
                    placeholder={`Ejemplo:\n• Desayuno: 250g kéfir + 60g avena + 3 huevos\n• Comida: 180g pollo/ternera + 250g patata o arroz + verdura\n• Cena: 180g pescado blanco/pavo + ensalada + AOVE`}
                    value={dietPlanDraft}
                    onChange={(e) => setDietPlanDraft(e.target.value)}
                    className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#4DF500] text-black font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#43d900] transition"
                >
                  <Utensils className="w-4 h-4" /> Guardar Dieta en la Nube
                </button>
              </form>
            )}

            {coachSubTab === "asignar" && (
              <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-extrabold">Enviar Directiva al Atleta</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    El mensaje se guardará en la nube para <strong className="text-white">{activeClient.name}</strong>.
                  </p>
                </div>

                <textarea
                  rows={4}
                  value={coachDirectiveDraft}
                  onChange={(e) => setCoachDirectiveDraft(e.target.value)}
                  className="w-full bg-[#0A0B0D] border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#4DF500]"
                />

                <button
                  onClick={handleUpdateCoachNote}
                  className="w-full bg-[#4DF500] text-black font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Guardar Directiva en la Nube
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ===================================================================== */
          /* ==================== VISTA MODO ATLETA (CLIENTE) ==================== */
          /* ===================================================================== */
          <>
            {restTimeLeft > 0 && (
              <div className="bg-[#151A14] border-b border-[#4DF500]/40 px-4 py-2.5 flex items-center justify-between sticky top-[65px] z-20">
                <div className="flex items-center gap-2.5">
                  <Timer className="w-4 h-4 text-[#4DF500] animate-pulse" />
                  <span className="text-xs font-bold text-zinc-200">Descanso activo:</span>
                  <span className="text-sm font-black text-[#4DF500] font-mono">{formatTime(restTimeLeft)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRestTimeLeft((t) => t + 30)}
                    className="text-[11px] bg-zinc-800 px-2 py-1 rounded-lg font-bold text-zinc-200"
                  >
                    +30s
                  </button>
                  <button
                    onClick={() => {
                      setRestTimeLeft(0);
                      setIsTimerRunning(false);
                    }}
                    className="text-[11px] bg-[#4DF500] text-black px-2.5 py-1 rounded-lg font-extrabold"
                  >
                    Saltar
                  </button>
                </div>
              </div>
            )}

            <div className="px-4 pt-5 space-y-5 flex-1">
              {activeTab === "hoy" && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                        Domingo, 22 Noviembre
                      </p>
                      <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
                        Hola, {activeClient.name.split(" ")[0]}
                      </h1>
                    </div>
                    <div className="bg-[#121417] border border-[#4DF500]/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Flame className="w-4 h-4 text-[#4DF500] fill-[#4DF500]" />
                      <div>
                        <p className="text-[10px] text-zinc-400 leading-none">Racha</p>
                        <p className="text-xs font-extrabold text-white leading-tight">14 días</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-[#15181C] via-[#111316] to-[#0D0F11] border border-zinc-800 rounded-2xl p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#4DF500]/10 blur-2xl rounded-full pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#4DF500] flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Estado Diario
                      </span>
                      <span className="text-xs font-semibold text-zinc-400">{kcalPercent}% completado</span>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 110 110">
                          <circle cx="55" cy="55" r="46" stroke="#1E2228" strokeWidth="10" fill="none" />
                          <circle
                            cx="55"
                            cy="55"
                            r="46"
                            stroke="#4DF500"
                            strokeWidth="10"
                            fill="none"
                            strokeDasharray={289}
                            strokeDashoffset={289 - (289 * kcalPercent) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute text-center">
                          <p className="text-xl font-black text-white leading-none">{consumedKcal}</p>
                          <p className="text-[10px] text-zinc-400 mt-1">/ {targetKcal} kcal</p>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2.5">
                        <div className="bg-[#181B20] border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Apple className="w-4 h-4 text-[#4DF500]" />
                            <span className="text-xs text-zinc-300">Nutrición</span>
                          </div>
                          <span className="text-xs font-extrabold">{completedMealsCount}/5</span>
                        </div>

                        <div className="bg-[#181B20] border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-sky-400" />
                            <span className="text-xs text-zinc-300">Pasos</span>
                          </div>
                          <span className="text-xs font-extrabold">{stepsToday.toLocaleString("es-ES")}</span>
                        </div>

                        <div className="bg-[#181B20] border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-zinc-300">Suplementos</span>
                          </div>
                          <span className="text-xs font-extrabold">{completedSuppsCount}/6</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab("dieta")}
                      className="mt-4 w-full bg-[#4DF500] hover:bg-[#43d900] text-black font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      Registrar siguiente comida ({5 - completedMealsCount} pendientes) <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Semana de Entrenamiento
                      </h2>
                      <span className="text-[11px] text-[#4DF500] font-semibold">Semana 4 · Bloque Hipertrofia</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {days.map((d) => {
                        const isSelected = selectedDay === d.short;
                        return (
                          <button
                            key={d.short}
                            onClick={() => setSelectedDay(d.short)}
                            className={`rounded-xl py-2.5 flex flex-col items-center gap-1.5 border transition ${
                              isSelected
                                ? "bg-[#4DF500] text-black border-[#4DF500] font-extrabold shadow-[0_0_12px_rgba(77,245,0,0.25)]"
                                : "bg-[#121417] text-zinc-400 border-zinc-800"
                            }`}
                          >
                            <span className="text-[11px]">{d.short}</span>
                            {d.done ? (
                              <Check className={`w-3.5 h-3.5 ${isSelected ? "text-black" : "text-[#4DF500]"}`} />
                            ) : (
                              <Dumbbell className={`w-3.5 h-3.5 ${isSelected ? "text-black" : "text-zinc-600"}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-[#4DF500]/15 text-[#4DF500] border border-[#4DF500]/30 px-2.5 py-1 rounded-md">
                        Sesión Programada · Hoy
                      </span>
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> ~60 min
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold tracking-tight">Día 2 · Espalda y Bíceps</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">4 ejercicios · Enfoque Fuerza e Hipertrofia</p>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">Coach: <strong className="text-zinc-200">Gustavo Prado</strong></span>
                      <button
                        onClick={() => {
                          setSelectedRoutineId(2);
                          setActiveTab("entreno");
                        }}
                        className="bg-[#4DF500] text-black font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        Iniciar Sesión <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#121417] border-l-4 border-l-[#4DF500] border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200">
                        Directiva del Coach
                      </h3>
                      <Award className="w-4 h-4 text-[#4DF500]" />
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {activeClient.coachNote}
                    </p>
                  </div>
                </>
              )}

              {activeTab === "entreno" && (
                <>
                  {activeRoutine ? (
                    <div className="space-y-4">
                      <button
                        onClick={() => setSelectedRoutineId(null)}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#4DF500] hover:underline"
                      >
                        <ChevronLeft className="w-4 h-4" /> Volver a todos los días
                      </button>

                      <div>
                        <span className="text-[10px] font-extrabold tracking-widest px-2 py-0.5 rounded bg-[#4DF500]/15 text-[#4DF500]">
                          {activeRoutine.tag}
                        </span>
                        <h1 className="text-xl font-extrabold mt-1">{activeRoutine.title}</h1>
                        <p className="text-xs text-zinc-400">{activeRoutine.duration} · Anota tus cargas y marca cada serie</p>
                      </div>

                      <div className="space-y-4">
                        {activeRoutine.exercises.map((ex, idx) => {
                          const isMediaOpen = openVideoExerciseId === ex.id;
                          return (
                            <div key={ex.id} className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <div
                                    onClick={() => setOpenVideoExerciseId(isMediaOpen ? null : ex.id)}
                                    className="w-12 h-12 rounded-xl bg-[#1A1D22] border border-zinc-700 overflow-hidden shrink-0 relative cursor-pointer group"
                                  >
                                    {ex.mediaUrl ? (
                                      <img
                                        src={ex.mediaUrl}
                                        alt={ex.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[#4DF500]">
                                        <Dumbbell className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                      <PlayCircle className="w-4 h-4 text-white" />
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#4DF500]">
                                      Ejercicio {idx + 1} · {ex.muscle}
                                    </p>
                                    <h3 className="font-bold text-sm text-white mt-0.5">{ex.name}</h3>
                                  </div>
                                </div>

                                <button
                                  onClick={() => startRestTimer(ex.restSeconds)}
                                  className="bg-[#181B20] border border-zinc-700 px-2.5 py-1 rounded-lg text-[11px] text-zinc-300 flex items-center gap-1 shrink-0 hover:border-[#4DF500]"
                                >
                                  <Timer className="w-3 h-3 text-[#4DF500]" /> {ex.restSeconds}s
                                </button>
                              </div>

                              {isMediaOpen && ex.mediaUrl && (
                                <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black">
                                  <img
                                    src={ex.mediaUrl}
                                    alt={ex.name}
                                    className="w-full h-44 object-cover"
                                  />
                                </div>
                              )}

                              <p className="text-[11px] text-zinc-400 bg-[#181B20] p-2.5 rounded-xl border border-zinc-800/80">
                                💡 {ex.note}
                              </p>

                              <div className="grid grid-cols-4 gap-2 text-[10px] font-bold uppercase text-zinc-500 px-1">
                                <span>Serie</span>
                                <span className="text-center">Peso (Kg)</span>
                                <span className="text-center">Reps</span>
                                <span className="text-right">Hecho</span>
                              </div>

                              <div className="space-y-2">
                                {ex.sets.map((s) => (
                                  <div
                                    key={s.id}
                                    className={`grid grid-cols-4 gap-2 items-center p-2 rounded-xl border transition ${
                                      s.done
                                        ? "bg-[#172115] border-[#4DF500]/40"
                                        : "bg-[#181B20] border-zinc-800"
                                    }`}
                                  >
                                    <span className="text-xs font-extrabold text-zinc-300 pl-1">#{s.id}</span>
                                    
                                    <input
                                      type="text"
                                      value={s.kg}
                                      onChange={(e) =>
                                        updateSetField(activeRoutine.id, ex.id, s.id, "kg", e.target.value)
                                      }
                                      className="w-full bg-[#0E1013] border border-zinc-700 rounded-lg py-1 text-center text-xs font-bold text-white focus:outline-none focus:border-[#4DF500]"
                                    />

                                    <input
                                      type="text"
                                      value={s.reps}
                                      onChange={(e) =>
                                        updateSetField(activeRoutine.id, ex.id, s.id, "reps", e.target.value)
                                      }
                                      className="w-full bg-[#0E1013] border border-zinc-700 rounded-lg py-1 text-center text-xs font-bold text-white focus:outline-none focus:border-[#4DF500]"
                                    />

                                    <div className="flex justify-end">
                                      <button
                                        onClick={() =>
                                          toggleSetDone(activeRoutine.id, ex.id, s.id, ex.restSeconds)
                                        }
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                                          s.done
                                            ? "bg-[#4DF500] text-black"
                                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                        }`}
                                      >
                                        <Check className="w-4 h-4 stroke-[2.5]" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setCompletedWorkouts((prev) => ({ ...prev, [activeRoutine.id]: true }));
                          setSelectedRoutineId(null);
                        }}
                        className="w-full bg-[#4DF500] text-black font-extrabold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Check className="w-5 h-5 stroke-[2.5]" /> Completar Entrenamiento del Día
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
                              <Activity className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">Resistencia · Pasos diarios</p>
                              <p className="text-xs text-sky-400 font-bold">
                                {stepsToday.toLocaleString("es-ES")}{" "}
                                <span className="text-zinc-500 font-normal">/ 10.000 pasos</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setStepsToday((prev) => prev + 1000)}
                            className="w-9 h-9 rounded-xl bg-sky-400 text-black flex items-center justify-center font-bold hover:bg-sky-300 transition"
                            title="Sumar 1.000 pasos"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.round((stepsToday / 10000) * 100))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <h1 className="text-xl font-extrabold tracking-tight">Plan de Entrenamiento</h1>
                        <p className="text-xs text-zinc-400 mt-1">
                          Toca cualquier día para abrir los ejercicios, pesos y cronómetro
                        </p>
                      </div>

                      <div className="space-y-3">
                        {routinesData.map((r) => {
                          const isDone = completedWorkouts[r.id];
                          return (
                            <div
                              key={r.id}
                              onClick={() => setSelectedRoutineId(r.id)}
                              className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                                isDone
                                  ? "bg-[#121417] border-[#4DF500]/60"
                                  : "bg-[#121417] border-zinc-800 hover:border-[#4DF500]/40"
                              }`}
                            >
                              <div className="flex items-center gap-3.5">
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                                    isDone
                                      ? "bg-[#4DF500] text-black"
                                      : "bg-[#1A1D22] text-zinc-300 border border-zinc-700"
                                  }`}
                                >
                                  {isDone ? <Check className="w-5 h-5 stroke-[2.5]" /> : r.id}
                                </div>
                                <div>
                                  <h3 className="font-bold text-sm">{r.title}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-[#4DF500]">
                                      {r.tag}
                                    </span>
                                    <p className="text-xs text-zinc-400">{r.exercisesCount}</p>
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === "dieta" && (
                <>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Combustible Diario
                    </p>
                    <h1 className="text-xl font-extrabold mt-0.5">Plan Nutricional</h1>
                  </div>

                  {activeClient.dietPlan && (
                    <div className="bg-[#121417] border border-[#4DF500]/40 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4DF500] flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5" /> Pauta Prescrita por el Coach
                        </span>
                        <span className="text-[11px] text-zinc-400">{targetKcal} kcal</span>
                      </div>
                      <p className="text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
                        {activeClient.dietPlan}
                      </p>
                    </div>
                  )}

                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" stroke="#1E2228" strokeWidth="9" fill="none" />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            stroke="#4DF500"
                            strokeWidth="9"
                            fill="none"
                            strokeDasharray={264}
                            strokeDashoffset={264 - (264 * Math.min(consumedKcal / targetKcal, 1))}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute text-center">
                          <p className="text-xl font-black leading-none">{remainingKcal}</p>
                          <p className="text-[10px] text-zinc-400 mt-1">kcal restan</p>
                        </div>
                      </div>

                      <div className="flex-1 pl-5 space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-300 font-medium">Proteína</span>
                            <span className="font-bold">
                              {consumedProtein}
                              <span className="text-zinc-500 font-normal">/{targetProtein}g</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#4DF500] rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.round((consumedProtein / Math.max(1, targetProtein)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-300 font-medium">Carbohidratos</span>
                            <span className="font-bold">
                              {consumedCarbs}
                              <span className="text-zinc-500 font-normal">/{targetCarbs}g</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-400 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.round((consumedCarbs / Math.max(1, targetCarbs)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-300 font-medium">Grasas</span>
                            <span className="font-bold">
                              {consumedFats}
                              <span className="text-zinc-500 font-normal">/{targetFats}g</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.round((consumedFats / Math.max(1, targetFats)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800 flex justify-between text-xs">
                      <span className="text-zinc-400">Consumido hoy</span>
                      <span className="font-bold">
                        {consumedKcal} / {targetKcal} kcal · {completedMealsCount}/5 comidas
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">Hidratación</p>
                          <p className="text-xs text-sky-400 font-bold">
                            {(waterGlasses * 0.25).toFixed(2)} L{" "}
                            <span className="text-zinc-500 font-normal">de 3 L · {waterGlasses} vasos</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWaterGlasses((w) => Math.max(0, w - 1))}
                          className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setWaterGlasses((w) => Math.min(12, w + 1))}
                          className="w-8 h-8 rounded-xl bg-sky-400 text-black flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-1.5">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-3.5 rounded transition ${
                            i < waterGlasses ? "bg-sky-400" : "bg-zinc-800"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ESCÁNER IA APEX CON ANÁLISIS REAL */}
                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#4DF500]/10 border border-[#4DF500]/30 text-[#4DF500] flex items-center justify-center">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">Escáner IA APEX</p>
                          <p className="text-[11px] text-zinc-400">Analiza macros de cualquier plato o etiqueta.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCameraOpen) {
                            stopCameraStream();
                          } else {
                            startCameraScan();
                          }
                        }}
                        className="bg-[#4DF500] text-black font-extrabold text-xs px-4 py-2 rounded-xl"
                      >
                        {isCameraOpen ? "Cerrar" : "Escanear"}
                      </button>
                    </div>

                    {cameraError && (
                      <p className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-xl p-2.5">
                        {cameraError}
                      </p>
                    )}

                    {isCameraOpen && (
                      <div className="space-y-2.5">
                        <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black relative">
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="w-full h-52 object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={capturePhotoFrame}
                          className="w-full bg-[#4DF500] text-black font-extrabold text-xs py-2.5 rounded-xl"
                        >
                          Tomar foto
                        </button>
                      </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />

                    {capturedPhoto && (
                      <form onSubmit={applyScannedMacros} className="space-y-3 pt-1">
                        <div className="rounded-xl overflow-hidden border border-[#4DF500]/40 bg-black">
                          <img
                            src={capturedPhoto}
                            alt="Captura de comida"
                            className="w-full h-44 object-cover"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={isAnalyzingAI}
                          onClick={analyzePhotoWithAI}
                          className="w-full bg-[#4DF500] hover:bg-[#43d900] disabled:opacity-60 text-black font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                          <Sparkles className="w-4 h-4" />
                          {isAnalyzingAI ? "Analizando con IA..." : "Analizar con IA"}
                        </button>

                        {aiDetectedSummary && (
                          <p className="text-[11px] text-[#4DF500] bg-[#172115] border border-[#4DF500]/30 rounded-xl p-2.5">
                            Detectado: <strong>{aiDetectedSummary}</strong>. Revisa o ajusta si hace falta y pulsa{" "}
                            <strong>Sumar a mi día</strong>.
                          </p>
                        )}

                        {aiWarning && (
                          <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-700/60 rounded-xl p-2.5">
                            {aiWarning}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">Calorías (kcal)</label>
                            <input
                              type="number"
                              value={scanKcal}
                              onChange={(e) => setScanKcal(e.target.value)}
                              className="w-full bg-[#0A0B0D] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">Proteína (g)</label>
                            <input
                              type="number"
                              value={scanProtein}
                              onChange={(e) => setScanProtein(e.target.value)}
                              className="w-full bg-[#0A0B0D] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">Carbohidratos (g)</label>
                            <input
                              type="number"
                              value={scanCarbs}
                              onChange={(e) => setScanCarbs(e.target.value)}
                              className="w-full bg-[#0A0B0D] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">Grasas (g)</label>
                            <input
                              type="number"
                              value={scanFats}
                              onChange={(e) => setScanFats(e.target.value)}
                              className="w-full bg-[#0A0B0D] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 bg-[#181B20] border border-[#4DF500]/50 text-[#4DF500] font-extrabold text-xs py-2.5 rounded-xl"
                          >
                            Sumar a mi día
                          </button>
                          <button
                            type="button"
                            onClick={startCameraScan}
                            className="px-3 py-2.5 rounded-xl bg-[#181B20] border border-zinc-700 text-xs text-zinc-300"
                          >
                            Repetir foto
                          </button>
                        </div>
                      </form>
                    )}

                    {scannerStatusMsg && (
                      <p className="text-[11px] text-[#4DF500] bg-[#172115] border border-[#4DF500]/30 rounded-xl p-2.5">
                        {scannerStatusMsg}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-sm">Comidas · Martes</h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={shareMealsWhatsApp}
                          className="bg-[#25D366] text-black font-bold text-xs px-3 py-1.5 rounded-xl"
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={exportPdfView}
                          className="bg-[#181B20] border border-zinc-800 text-zinc-300 font-semibold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> PDF
                        </button>
                      </div>
                    </div>

                    {meals.map((meal) => {
                      const isDone = completedMeals[meal.id];
                      const isExpanded = expandedMeal === meal.id;
                      const isPrepOpen = openPrepMealId === meal.id;
                      return (
                        <div
                          key={meal.id}
                          className={`rounded-2xl border p-4 transition ${
                            isDone
                              ? "bg-[#121417] border-[#4DF500]/50"
                              : "bg-[#121417] border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleMeal(meal.id)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                                  isDone
                                    ? "bg-[#4DF500] text-black font-bold"
                                    : "bg-[#181B20] border border-zinc-700 text-zinc-400"
                                }`}
                              >
                                {isDone ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4" />}
                              </button>
                              <div
                                onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-sm">{meal.name}</h3>
                                  <span className="text-xs text-zinc-500">{meal.time}</span>
                                </div>
                                <p className="text-xs text-zinc-400 truncate max-w-[180px]">{meal.summary}</p>
                              </div>
                            </div>
                            <div
                              onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <div className="text-right">
                                <p className="font-bold text-sm">{meal.kcal}</p>
                                <p className="text-[10px] text-zinc-500">kcal</p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-zinc-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-zinc-500" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-3 border-t border-zinc-800 space-y-2">
                              {meal.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="bg-[#181B20] rounded-xl p-3 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Apple className="w-4 h-4 text-[#4DF500]" />
                                    <div>
                                      <p className="text-xs font-semibold">{item.name}</p>
                                      <p className="text-[11px] text-zinc-400">{item.detail}</p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold">{item.kcal} kcal</span>
                                </div>
                              ))}
                              <button
                                onClick={() => setOpenPrepMealId(isPrepOpen ? null : meal.id)}
                                className="w-full py-2.5 rounded-xl bg-[#181B20] border border-zinc-800 text-[#4DF500] text-xs font-semibold flex items-center justify-center gap-1.5 mt-2"
                              >
                                <Flame className="w-3.5 h-3.5" />{" "}
                                {isPrepOpen ? "Ocultar preparación" : "Ver preparación"}
                              </button>
                              {isPrepOpen && (
                                <p className="text-xs text-zinc-300 bg-[#0E1013] border border-zinc-800 rounded-xl p-3 leading-relaxed">
                                  {meal.prep}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-base flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#4DF500]" /> Protocolo de Suplementación
                      </h2>
                      <span className="text-xs text-zinc-400">{completedSuppsCount}/6 hoy</span>
                    </div>

                    {supplements.map((s) => {
                      const isDone = completedSupps[s.id];
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSupp(s.id)}
                          className={`p-4 rounded-2xl border space-y-2.5 cursor-pointer transition ${
                            isDone
                              ? "bg-[#121417] border-[#4DF500]/50"
                              : "bg-[#121417] border-zinc-800"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isDone
                                  ? "bg-[#4DF500] text-black"
                                  : "bg-[#181B20] border border-zinc-700 text-zinc-400"
                              }`}
                            >
                              {isDone ? (
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              ) : s.icon === "bolt" ? (
                                <Zap className="w-4 h-4" />
                              ) : (
                                <Heart className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-sm">
                                {s.name} <span className="text-[#4DF500]">{s.dose}</span>
                              </h3>
                              <p className="text-xs text-zinc-400">{s.brand}</p>
                              <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] bg-[#181B20] border border-zinc-700 text-[#4DF500] px-2.5 py-0.5 rounded-md">
                                <Clock className="w-3 h-3" /> {s.timing}
                              </span>
                              <p className="text-xs text-zinc-300 mt-2">{s.note}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Aviso de reposición enviado para: ${s.name}`);
                            }}
                            className="w-full py-2 rounded-xl bg-[#181B20] border border-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5"
                          >
                            <Bell className="w-3.5 h-3.5" /> Solicitar reposición
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-base flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-[#4DF500]" /> Lista de la Compra
                      </h2>
                      <span className="text-xs bg-zinc-800 px-2.5 py-1 rounded-md text-zinc-300">
                        {Object.values(checkedGroceries).filter(Boolean).length}/{groceryItems.length}
                      </span>
                    </div>

                    <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3">
                      <p className="text-xs text-zinc-400">{groceryItems.length} productos semanales</p>
                      <div className="flex gap-2">
                        {["Mercadona", "HiperDino", "Lidl"].map((shop) => (
                          <button
                            key={shop}
                            onClick={() => setSelectedSupermarket(shop)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              selectedSupermarket === shop
                                ? "bg-[#4DF500]/15 text-[#4DF500] border border-[#4DF500]/40"
                                : "bg-[#181B20] text-zinc-400"
                            }`}
                          >
                            {shop}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={shareGroceryWhatsApp}
                          className="flex-1 py-2 rounded-xl bg-[#25D366] text-black font-bold text-xs"
                        >
                          Enviar por WhatsApp
                        </button>
                        <button
                          onClick={exportPdfView}
                          className="px-4 py-2 rounded-xl bg-[#181B20] border border-zinc-800 text-zinc-300 font-semibold text-xs"
                        >
                          PDF
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-zinc-200">Frutas · {groceryItems.length}</p>
                      {groceryItems.map((item) => {
                        const checked = !!checkedGroceries[item.id];
                        return (
                          <div
                            key={item.id}
                            onClick={() =>
                              setCheckedGroceries((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                            }
                            className="flex items-start gap-3 cursor-pointer"
                          >
                            <div
                              className={`w-5 h-5 rounded-md border mt-0.5 flex items-center justify-center ${
                                checked
                                  ? "bg-[#4DF500] border-[#4DF500] text-black"
                                  : "border-zinc-600"
                              }`}
                            >
                              {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${checked ? "line-through text-zinc-500" : ""}`}>
                                {item.name}
                              </p>
                              <p className="text-[11px] text-zinc-400">{item.detail}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "progreso" && (
                <div className="space-y-4">
                  <h1 className="text-xl font-extrabold">Métricas de Rendimiento</h1>
                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-5 space-y-2">
                    <p className="text-xs text-zinc-400">Peso corporal actual</p>
                    <p className="text-3xl font-black text-[#4DF500]">66.5 kg</p>
                    <p className="text-xs text-zinc-400">+1.2 kg este mes · Fuerza máxima en ascenso</p>
                  </div>
                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-5 space-y-2">
                    <h3 className="font-bold text-sm">Marcas Personales (1RM Estimado)</h3>
                    <div className="flex justify-between text-xs py-2.5 border-b border-zinc-800">
                      <span className="text-zinc-400">Press de Banca</span>
                      <span className="font-extrabold text-white">105 kg</span>
                    </div>
                    <div className="flex justify-between text-xs py-2.5 border-b border-zinc-800">
                      <span className="text-zinc-400">Sentadilla Libre</span>
                      <span className="font-extrabold text-white">135 kg</span>
                    </div>
                    <div className="flex justify-between text-xs py-2.5">
                      <span className="text-zinc-400">Peso Muerto</span>
                      <span className="font-extrabold text-white">160 kg</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "perfil" && (
                <div className="space-y-4">
                  <h1 className="text-xl font-extrabold">Perfil de Atleta</h1>
                  <div className="bg-[#121417] border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#4DF500]/50 shrink-0">
                      <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover scale-125" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-base">{activeClient.name}</h2>
                      <p className="text-xs text-zinc-400">{activeClient.goal}</p>
                      <p className="text-[10px] font-bold text-[#4DF500] uppercase tracking-wider mt-1">
                        {activeClient.plan}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[410px] bg-[#121417]/95 backdrop-blur-md border border-zinc-800 rounded-2xl px-2 py-2 flex items-center justify-around z-40 shadow-2xl">
              {[
                { id: "hoy", label: "Hoy", icon: Home },
                { id: "entreno", label: "Entreno", icon: Dumbbell },
                { id: "dieta", label: "Dieta", icon: Apple },
                { id: "progreso", label: "Progreso", icon: TrendingUp },
                { id: "perfil", label: "Perfil", icon: User },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      stopCameraStream();
                      setSelectedRoutineId(null);
                      setActiveTab(tab.id as any);
                    }}
                    className={`flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl transition ${
                      isActive
                        ? "bg-[#4DF500]/15 text-[#4DF500] border border-[#4DF500]/30"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold mt-0.5">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}