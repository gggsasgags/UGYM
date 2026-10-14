import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import Landing from "./site/Landing";
import AppShell from "./app/AppShell";
import { Auth } from "./auth/Auth";
import { NovaSenha } from "./auth/NovaSenha";
import { Privacidade } from "./site/Legal";
import { StoreProvider } from "./lib/store";

/**
 * O Gastô usa HashRouter, então a rota de verdade vive depois do "#".
 * O Vercel Analytics olha só para o caminho antes do "#", e sem isso toda
 * visita entraria no painel como "/". Aqui a gente devolve o evento com a
 * rota do hash no lugar do caminho, e só isso: nada é bloqueado nem somado.
 */
function comARota(evento: BeforeSendEvent): BeforeSendEvent {
  try {
    const endereco = new URL(evento.url);
    if (endereco.hash.startsWith("#/")) {
      return { ...evento, url: endereco.origin + endereco.hash.slice(1) };
    }
  } catch {
    // endereço estranho: manda como veio
  }
  return evento;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Auth mode="entrar" />} />
          <Route path="/criar-conta" element={<Auth mode="criar" />} />
          <Route path="/nova-senha" element={<NovaSenha />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/app" element={<AppShell />} />
          <Route path="/app/:tab" element={<AppShell />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Analytics beforeSend={comARota} />
    </StoreProvider>
  );
}
