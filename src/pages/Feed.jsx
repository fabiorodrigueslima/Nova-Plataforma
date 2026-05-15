import { useState } from "react";

import Sidebar from "../components/Sidebar";
import FeedCenter from "../components/FeedCenter";
import RightPanel from "../components/RightPanel";

import "../styles/style.css";

export default function Feed() {
    const [temaAtivo, setTemaAtivo] = useState("Todos");

    const [posts, setPosts] = useState(() => {
        const salvos = localStorage.getItem("postsPostfan");
        return salvos ? JSON.parse(salvos) : [];
    });

    return (
        <main className="feed-page">
            <Sidebar
                temaAtivo={temaAtivo}
                setTemaAtivo={setTemaAtivo}
            />

            <FeedCenter
                temaAtivo={temaAtivo}
                posts={posts}
                setPosts={setPosts}
            />

            <RightPanel posts={posts} />
        </main>
    );
}