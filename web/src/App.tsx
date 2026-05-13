import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Console } from "./pages/Console";
import { Translator } from "./pages/Translator";

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Console />} />
        <Route path="/translator" element={<Translator />} />
      </Routes>
    </BrowserRouter>
  );
}
