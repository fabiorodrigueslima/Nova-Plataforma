import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { analisarConteudo } from "../utils/moderacao";
import "../styles/style.css";

export default function SalaVirtual() {
    const navigate = useNavigate();

    const [aba, setAba] = useState("meus");
    const [meusGrupos, setMeusGrupos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [solicitacoes, setSolicitacoes] = useState({});
    const [codigo, setCodigo] = useState("");

    const [modalExcluir, setModalExcluir] = useState(false);
    const [grupoExcluir, setGrupoExcluir] = useState(null);

    const [modalSucesso, setModalSucesso] = useState(false);
    const [sucessoTitulo, setSucessoTitulo] = useState("");
    const [sucessoTexto, setSucessoTexto] = useState("");
    const [sucessoCodigo, setSucessoCodigo] = useState("");
    const [grupoEntrarId, setGrupoEntrarId] = useState(null);

    const [form, setForm] = useState({
        nome: "",
        descricao: "",
        categoria: "",
    });

    async function carregarMeusGrupos() {
        try {
            const res = await api.get("/api/meus-grupos");
            const lista = Array.isArray(res.data) ? res.data : [];
            setMeusGrupos(lista);

            const admins = lista.filter((grupo) => grupo.papel === "admin" && grupo.tipo === "publico");
            const respostas = await Promise.all(
                admins.map(async (grupo) => {
                    const solicitacoesRes = await api.get(`/api/grupos/${grupo.id}/solicitacoes`);
                    return [grupo.id, Array.isArray(solicitacoesRes.data) ? solicitacoesRes.data : []];
                }),
            );

            setSolicitacoes(Object.fromEntries(respostas));
        } catch (error) {
            console.error("Erro ao carregar meus grupos:", error);
        }
    }

    async function carregarGrupos() {
        try {
            const res = await api.get("/api/grupos");
            setGrupos(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Erro ao carregar grupos:", error);
        }
    }

    useEffect(() => {
        carregarMeusGrupos();
        carregarGrupos();
    }, []);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    function abrirModalExcluir(grupo) {
        setGrupoExcluir(grupo);
        setModalExcluir(true);
    }

    function fecharModalExcluir() {
        setGrupoExcluir(null);
        setModalExcluir(false);
    }

    function abrirModalSucesso(titulo, texto, codigo = "", grupoId = null) {
        setSucessoTitulo(titulo);
        setSucessoTexto(texto);
        setSucessoCodigo(codigo);
        setGrupoEntrarId(grupoId);
        setModalSucesso(true);
    }

    function fecharModalSucesso() {
        setModalSucesso(false);
        setSucessoTitulo("");
        setSucessoTexto("");
        setSucessoCodigo("");

        if (grupoEntrarId) {
            navigate(`/grupo/${grupoEntrarId}`);
            setGrupoEntrarId(null);
        }
    }

    function copiarCodigo(codigoCopiar) {
        navigator.clipboard.writeText(codigoCopiar);

        abrirModalSucesso(
            "Código copiado!",
            "Agora você pode enviar esse código para os usuários convidados."
        );
    }

    async function criarGrupo(e) {
        e.preventDefault();

        const moderacao = analisarConteudo(
            `${form.nome} ${form.descricao} ${form.categoria}`
        );

        if (!moderacao.aprovado) {
            abrirModalSucesso("Revise o grupo", moderacao.motivo);
            return;
        }

        try {
            const res = await api.post("/api/grupos", { ...form, tipo: "publico" });

            setForm({
                nome: "",
                descricao: "",
                categoria: "",
            });

            setAba("meus");

            await carregarMeusGrupos();
            await carregarGrupos();

            abrirModalSucesso(
                "Grupo criado com sucesso!",
                "Seu grupo foi criado gratuitamente. Agora os usuários poderão solicitar entrada, e você decide quem participa.",
                "",
                res.data.grupo?.id
            );
        } catch (error) {
            console.error("Erro ao criar grupo:", error);

            abrirModalSucesso(
                "Erro ao criar grupo",
                error.response?.data?.erro ||
                "Aconteceu um problema ao criar o grupo. Tente novamente."
            );
        }
    }

    async function entrarComCodigo(e) {
        e.preventDefault();

        try {
            const res = await api.post("/api/grupos/entrar", {
                codigo,
            });

            setCodigo("");

            await carregarMeusGrupos();

            abrirModalSucesso(
                "Entrada liberada!",
                "Você entrou no grupo com sucesso. Agora pode participar da conversa.",
                "",
                res.data.grupo?.id
            );
        } catch (error) {
            console.error("Erro ao entrar no grupo:", error);

            abrirModalSucesso(
                "Erro ao entrar no grupo",
                error.response?.data?.erro ||
                "Aconteceu um problema ao tentar entrar no grupo."
            );
        }
    }

    async function excluirGrupo() {
        if (!grupoExcluir) return;

        try {
            await api.delete(`/api/grupos/${grupoExcluir.id}`);

            fecharModalExcluir();

            await carregarMeusGrupos();
            await carregarGrupos();

            abrirModalSucesso(
                "Grupo excluído com sucesso!",
                "O grupo, os membros e todas as mensagens foram removidas permanentemente."
            );
        } catch (error) {
            console.error("Erro ao excluir grupo:", error);

            abrirModalSucesso(
                "Erro ao excluir grupo",
                error.response?.data?.erro ||
                "Aconteceu um problema ao excluir o grupo. Tente novamente."
            );
        }
    }

    async function criarSalaReservada(e) {
        e.preventDefault();

        const moderacao = analisarConteudo(
            `${form.nome} ${form.descricao} ${form.categoria}`
        );

        if (!moderacao.aprovado) {
            abrirModalSucesso("Revise a sala reservada", moderacao.motivo);
            return;
        }

        try {
            const res = await api.post("/api/grupos", { ...form, tipo: "reservada" });

            setForm({
                nome: "",
                descricao: "",
                categoria: "",
            });

            setAba("meus");

            await carregarMeusGrupos();
            await carregarGrupos();

            abrirModalSucesso(
                "Sala Reservada criada!",
                "A sala tem 7 dias de teste gratuito. Depois desse período, o acesso será preparado para pagamento.",
                res.data.grupo?.codigo_convite,
                res.data.grupo?.id
            );
        } catch (error) {
            console.error("Erro ao criar sala reservada:", error);

            abrirModalSucesso(
                "Erro ao criar sala reservada",
                error.response?.data?.erro ||
                "Aconteceu um problema ao criar a sala reservada. Tente novamente."
            );
        }
    }

    async function solicitarEntrada(grupoId) {
        try {
            await api.post(`/api/grupos/${grupoId}/solicitar`);
            await carregarGrupos();

            abrirModalSucesso(
                "Solicitação enviada!",
                "O administrador do grupo recebeu seu pedido e poderá liberar sua entrada."
            );
        } catch (error) {
            abrirModalSucesso(
                "Solicitação não enviada",
                error.response?.data?.erro ||
                "Aconteceu um problema ao solicitar entrada no grupo."
            );
        }
    }

    async function responderSolicitacao(grupoId, solicitacaoId, acao) {
        try {
            await api.post(`/api/grupos/${grupoId}/solicitacoes/${solicitacaoId}`, { acao });
            await carregarMeusGrupos();

            abrirModalSucesso(
                acao === "aprovar" ? "Entrada aprovada!" : "Solicitação recusada",
                acao === "aprovar"
                    ? "O usuário já pode acessar o grupo."
                    : "A solicitação foi recusada."
            );
        } catch (error) {
            abrirModalSucesso(
                "Não foi possível responder",
                error.response?.data?.erro ||
                "Aconteceu um problema ao responder a solicitação."
            );
        }
    }

    return (
        <main className="sala-page">
            <section className="sala-hero">
                <button className="sala-voltar" onClick={() => navigate("/feed")}>
                    ← Voltar
                </button>

                <h1>Sala Virtual</h1>

                <p>
                    Crie grupos, converse e se conecte com a comunidade em tempo real.
                </p>

                <p>
                    A Sala Virtual é um espaço para estudos, debates, amizades,
                    troca de ideias e conversas em grupo.
                </p>

                <div className="sala-reservada-info">
                    <h2>Venha para a Sala Reservada!</h2>

                    <p>
                        Convide as pessoas para ver suas postagens, debater,
                        opinar e estudar.
                    </p>

                    <p>
                        Se você quer continuar a discussão e debater os temas
                        com os usuários que te impressionaram, convide-os para
                        a Sala Reservada — um ambiente discreto e projetado para
                        quem deseja interagir com pessoas selecionadas em um
                        espaço reservado para convidados.
                    </p>

                    <p>
                        Construa amizades! Respeite as diferenças! Faça amigos
                        e não inimigos!
                    </p>
                </div>
            </section>

            <section className="sala-container">
                <div className="sala-tabs">
                    <button
                        className={aba === "meus" ? "active" : ""}
                        onClick={() => setAba("meus")}
                    >
                        Meus Grupos
                    </button>

                    <button
                        className={aba === "explorar" ? "active" : ""}
                        onClick={() => setAba("explorar")}
                    >
                        Explorar Grupos
                    </button>

                    <button
                        className={aba === "criar" ? "active" : ""}
                        onClick={() => setAba("criar")}
                    >
                        Criar Grupo
                    </button>

                    <button
                        className={aba === "reservada" ? "active" : ""}
                        onClick={() => setAba("reservada")}
                    >
                        Sala Reservada
                    </button>
                </div>

                {aba === "meus" && (
                    <div className="sala-box">
                        <div className="sala-box-top">
                            <h2>Meus Grupos</h2>

                            <button
                                className="novo-grupo-btn"
                                onClick={() => setAba("criar")}
                            >
                                + Criar Grupo
                            </button>
                        </div>

                        {meusGrupos.length === 0 ? (
                            <p className="sala-vazio">
                                Você ainda não participa de nenhum grupo.
                            </p>
                        ) : (
                            <div className="sala-grid">
                                {meusGrupos.map((grupo) => (
                                    <article className="grupo-card" key={grupo.id}>
                                        <div className="grupo-top">
                                            <h3>{grupo.nome}</h3>
                                            <span>{grupo.categoria || "Geral"}</span>
                                        </div>

                                        <p>{grupo.descricao}</p>

                                        <small>👥 {grupo.total_membros || 1} membros</small>
                                        <small>👑 {grupo.papel}</small>

                                        {grupo.papel === "admin" && grupo.tipo === "reservada" && (
                                            <div className="grupo-codigo">
                                                Código: <strong>{grupo.codigo_convite}</strong>

                                                <button
                                                    type="button"
                                                    className="btn-copiar-codigo"
                                                    onClick={() =>
                                                        copiarCodigo(grupo.codigo_convite)
                                                    }
                                                >
                                                    Copiar
                                                </button>
                                            </div>
                                        )}

                                        {grupo.tipo === "reservada" && (
                                            <p className="grupo-aviso">
                                                Teste gratuito: {grupo.teste_expira_em
                                                    ? new Date(grupo.teste_expira_em).toLocaleDateString("pt-BR")
                                                    : "7 dias"}
                                            </p>
                                        )}

                                        {grupo.papel === "admin" &&
                                            grupo.tipo === "publico" &&
                                            (solicitacoes[grupo.id] || []).length > 0 && (
                                                <div className="grupo-solicitacoes">
                                                    <strong>Solicitações pendentes</strong>

                                                    {(solicitacoes[grupo.id] || []).map((solicitacao) => (
                                                        <div className="grupo-solicitacao" key={solicitacao.id}>
                                                            <span>{solicitacao.nome}</span>

                                                            <div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        responderSolicitacao(
                                                                            grupo.id,
                                                                            solicitacao.id,
                                                                            "aprovar"
                                                                        )
                                                                    }
                                                                >
                                                                    Aprovar
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        responderSolicitacao(
                                                                            grupo.id,
                                                                            solicitacao.id,
                                                                            "recusar"
                                                                        )
                                                                    }
                                                                >
                                                                    Recusar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                        <div className="grupo-actions">
                                            <button
                                                onClick={() => navigate(`/grupo/${grupo.id}`)}
                                            >
                                                Acessar
                                            </button>

                                            {grupo.papel === "admin" && (
                                                <button
                                                    className="btn-excluir-grupo"
                                                    onClick={() => abrirModalExcluir(grupo)}
                                                >
                                                    Excluir
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {aba === "explorar" && (
                    <div className="sala-box">
                        <h2>Explorar Grupos</h2>

                        {grupos.length === 0 ? (
                            <p className="sala-vazio">Nenhum grupo criado ainda.</p>
                        ) : (
                            <div className="sala-grid">
                                {grupos.map((grupo) => (
                                    <article className="grupo-card" key={grupo.id}>
                                        <div className="grupo-top">
                                            <h3>{grupo.nome}</h3>
                                            <span>{grupo.categoria || "Geral"}</span>
                                        </div>

                                        <p>{grupo.descricao}</p>

                                        <small>Criado por {grupo.dono_nome}</small>
                                        <small>👥 {grupo.total_membros || 0} membros</small>

                                        {grupo.membro ? (
                                            <button onClick={() => navigate(`/grupo/${grupo.id}`)}>
                                                Acessar
                                            </button>
                                        ) : grupo.solicitacao_pendente ? (
                                            <p className="grupo-aviso">
                                                Solicitação enviada. Aguarde o administrador aprovar.
                                            </p>
                                        ) : (
                                            <button onClick={() => solicitarEntrada(grupo.id)}>
                                                Solicitar entrada
                                            </button>
                                        )}
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {aba === "criar" && (
                    <div className="sala-box">
                        <h2>Criar Grupo</h2>

                        <form className="sala-form" onSubmit={criarGrupo}>
                            <label>
                                Nome do grupo
                                <input
                                    type="text"
                                    name="nome"
                                    value={form.nome}
                                    onChange={handleChange}
                                    placeholder="Ex: Estudo de matemática"
                                    required
                                />
                            </label>

                            <label>
                                Categoria
                                <input
                                    type="text"
                                    name="categoria"
                                    value={form.categoria}
                                    onChange={handleChange}
                                    placeholder="Ex: Estudos, amizade, debate..."
                                />
                            </label>

                            <label>
                                Descrição
                                <textarea
                                    name="descricao"
                                    value={form.descricao}
                                    onChange={handleChange}
                                    placeholder="Explique o objetivo do grupo..."
                                    required
                                />
                            </label>

                            <button type="submit">Criar Grupo</button>
                        </form>
                    </div>
                )}

                {aba === "reservada" && (
                    <div className="sala-box">
                        <h2>Sala Reservada</h2>

                        <p className="sala-reservada-texto">
                            A Sala Reservada continua privada e só permite entrada com código.
                            Neste teste, o acesso fica gratuito por 7 dias. Depois, a sala
                            será preparada para liberação paga.
                        </p>

                        <p className="sala-reservada-texto">
                            Criar grupo público é gratuito. Criar Sala Reservada também
                            está liberado neste período de teste, mas o acesso dos membros
                            será limitado pelo prazo gratuito.
                        </p>

                        <div className="sala-reservada-dupla">
                            <form className="sala-form" onSubmit={criarSalaReservada}>
                                <h3>Criar Sala Reservada</h3>

                                <label>
                                    Nome da sala
                                    <input
                                        type="text"
                                        name="nome"
                                        value={form.nome}
                                        onChange={handleChange}
                                        placeholder="Ex: Estudos reservados"
                                        required
                                    />
                                </label>

                                <label>
                                    Categoria
                                    <input
                                        type="text"
                                        name="categoria"
                                        value={form.categoria}
                                        onChange={handleChange}
                                        placeholder="Ex: Estudos, debate, amizade..."
                                    />
                                </label>

                                <label>
                                    Descrição
                                    <textarea
                                        name="descricao"
                                        value={form.descricao}
                                        onChange={handleChange}
                                        placeholder="Explique o objetivo da sala reservada..."
                                        required
                                    />
                                </label>

                                <button type="submit">Criar Sala Reservada</button>
                            </form>

                            <form className="sala-form" onSubmit={entrarComCodigo}>
                                <h3>Entrar com Código</h3>

                                <label>
                                    Código da Sala Reservada
                                    <input
                                        type="text"
                                        value={codigo}
                                        onChange={(e) => setCodigo(e.target.value)}
                                        placeholder="Digite o código enviado pelo administrador"
                                        required
                                    />
                                </label>

                                <button type="submit">Entrar na Sala Reservada</button>
                            </form>
                        </div>
                    </div>
                )}
            </section>

            {modalExcluir && (
                <div className="modal-overlay">
                    <div className="modal-excluir">
                        <div className="modal-icon">⚠️</div>

                        <h2>Excluir grupo</h2>

                        <p>
                            Tem certeza que deseja excluir o grupo
                            <strong> {grupoExcluir?.nome}</strong>?
                        </p>

                        <span>
                            Todas as mensagens, membros e conversas serão removidas
                            permanentemente.
                        </span>

                        <div className="modal-actions">
                            <button className="modal-cancelar" onClick={fecharModalExcluir}>
                                Cancelar
                            </button>

                            <button
                                className="modal-excluir-btn"
                                onClick={excluirGrupo}
                            >
                                Excluir grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalSucesso && (
                <div className="modal-overlay">
                    <div className="modal-sucesso">
                        <div className="modal-sucesso-icon">
                            {sucessoTitulo.toLowerCase().includes("erro") ? "!" : "✓"}
                        </div>

                        <h2>{sucessoTitulo}</h2>

                        <p>{sucessoTexto}</p>

                        {sucessoCodigo && (
                            <div className="modal-codigo-box">
                                <span>Código do grupo</span>

                                <strong>{sucessoCodigo}</strong>

                                <button
                                    type="button"
                                    onClick={() => copiarCodigo(sucessoCodigo)}
                                >
                                    Copiar código
                                </button>
                            </div>
                        )}

                        <button className="modal-ok-btn" onClick={fecharModalSucesso}>
                            Entendi
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
