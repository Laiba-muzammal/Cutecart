import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { motion } from "framer-motion";
import productNotebook from "../assets/product-notebook.jpg";

const coverDesigns = ["Floral", "Minimalist", "Kawaii", "Abstract"];
const coverColors = ["#FFB6C1", "#E6E6FA", "#98FB98", "#FFE4B5"];

const Customize = () => {
  const [design, setDesign] = useState("Floral");
  const [color, setColor] = useState("#FFB6C1");
  const [nameText, setNameText] = useState("");
  const [quoteText, setQuoteText] = useState("");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-2">Customize Your <span className="text-gradient">Notebook</span> ✨</h1>
            <p className="text-muted-foreground">Design your perfect personalized notebook</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Preview */}
            <div className="relative rounded-2xl overflow-hidden shadow-glow" style={{ backgroundColor: color }}>
              <img src={productNotebook} alt="Notebook preview" className="w-full opacity-80 mix-blend-multiply" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                {nameText && <p className="text-2xl font-bold text-foreground/90">{nameText}</p>}
                {quoteText && <p className="text-sm italic text-foreground/70 mt-2">"{quoteText}"</p>}
              </div>
            </div>
            {/* Options */}
            <div className="space-y-6">
              <div><Label>Cover Design</Label><div className="flex gap-2 mt-2">{coverDesigns.map((d) => (<button key={d} onClick={() => setDesign(d)} className={`px-4 py-2 rounded-xl text-sm transition-all ${design === d ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{d}</button>))}</div></div>
              <div><Label>Cover Color</Label><div className="flex gap-3 mt-2">{coverColors.map((c) => (<button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }} className={`w-10 h-10 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} />))}</div></div>
              <div><Label htmlFor="name">Your Name</Label><Input id="name" placeholder="Enter your name" value={nameText} onChange={(e) => setNameText(e.target.value)} className="mt-2 rounded-xl" /></div>
              <div><Label htmlFor="quote">Custom Quote</Label><Input id="quote" placeholder="Add a quote" value={quoteText} onChange={(e) => setQuoteText(e.target.value)} className="mt-2 rounded-xl" /></div>
              <Button variant="hero" size="lg" className="w-full">Add to Cart - $14.99</Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Customize;
