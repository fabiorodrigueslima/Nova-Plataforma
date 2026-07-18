import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Recuperar from "./pages/Recuperar";
import ResetarSenha from "./pages/ResertarSenha";
import Feed from "./pages/Feed";

import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import Cookies from "./pages/Cookies";
import Seguranca from "./pages/Seguranca";
import Ajuda from "./pages/Ajuda";
import Perfil from "./pages/Perfil";
import EditarPerfil from "./pages/EditarPerfil";
import SalaVirtual from "./pages/SalaVirtual";
import GrupoChat from "./pages/GrupoChat";
import Sugestoes from "./pages/Sugestoes";
import Explorar from "./pages/Explorar";
import Configuracoes from "./pages/Configuracoes";
import Mensagens from "./pages/Mensagens";
import PrivateRoutes from "./routes/PrivateRoutes";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />

      <Route path="/cadastro" element={<Cadastro />} />

      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/resetar-senha" element={<ResetarSenha />} />

      <Route element={<PrivateRoutes />}>
        <Route path="/feed" element={<Feed />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/perfil/:id" element={<Perfil />} />
        <Route path="/editar-perfil" element={<EditarPerfil />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/sala-virtual" element={<SalaVirtual />} />
        <Route path="/grupo/:id" element={<GrupoChat />} />
        <Route path="/sugestoes" element={<Sugestoes />} />
        <Route path="/explorar" element={<Explorar />} />
      </Route>


      <Route path="/termos" element={<Termos />} />
      <Route path="/privacidade" element={<Privacidade />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/seguranca" element={<Seguranca />} />
      <Route path="/ajuda" element={<Ajuda />} />
    </Routes>
  );
}
