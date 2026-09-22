/* Latar bergerak untuk permukaan navy (.pub-navy): tiga cahaya aurora yang melayang pelan dan kisi tipis
   yang bergeser, semuanya hanya transform dan opacity sehingga ringan di GPU. Hiasan murni (aria-hidden);
   geraknya berhenti bila pengguna memilih prefers-reduced-motion. Induknya harus position: relative. */
export default function LatarNavy() {
  return (
    <span className="ln" aria-hidden="true">
      <span className="ln-cahaya ln-a" />
      <span className="ln-cahaya ln-b" />
      <span className="ln-cahaya ln-c" />
      <span className="ln-kisi" />
    </span>
  );
}
