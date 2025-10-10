import React from 'react';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

const SliderInput: React.FC<SliderInputProps> = ({ label, value, onChange, min, max, step = 1, unit = '' }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-sm">
        <label className="font-medium text-neutral-300">{label}</label>
        <div className="flex items-center">
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            className="w-20 bg-neutral-800 text-neutral-100 rounded-md px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {unit && <span className="ml-2 text-neutral-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
      />
    </div>
  );
};

export default SliderInput;