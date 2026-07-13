import InstallmentCalculator from "@/components/calculators/InstallmentCalculator";
import ROICalculator from "@/components/calculators/ROICalculator";
import CurrencyConverter from "@/components/calculators/CurrencyConverter";

export const metadata = {
  title: "Hesaplama Araçları | Jasmine Proje Pazarlama"
};

export default function CalculatorsPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-4xl font-serif font-bold text-center mb-12">Yatırım ve Hesaplama Araçları</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <InstallmentCalculator />
        <ROICalculator />
        <CurrencyConverter />
      </div>
    </div>
  );
}
