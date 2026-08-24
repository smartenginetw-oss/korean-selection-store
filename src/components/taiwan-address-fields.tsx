"use client";

import { useState } from "react";
import { districtsForCity, taiwanCities } from "@/lib/taiwan-address";

type TaiwanAddressFieldsProps = {
  className?: string;
  idPrefix: string;
  defaultCity?: string;
  defaultDistrict?: string;
  cityName?: string;
  districtName?: string;
};

/**
 * Shared Taiwan city/district selectors. Keeping the values in one component
 * prevents checkout and saved member addresses from drifting apart.
 */
export function TaiwanAddressFields({
  className,
  idPrefix,
  defaultCity = "",
  defaultDistrict = "",
  cityName = "city",
  districtName = "district",
}: TaiwanAddressFieldsProps) {
  const [city, setCity] = useState(defaultCity);
  const [district, setDistrict] = useState(defaultDistrict);
  const districts = districtsForCity(city, district);

  return <div className={className}>
    <div className="field">
      <label htmlFor={`${idPrefix}-city`}>縣市</label>
      <select
        className="input"
        id={`${idPrefix}-city`}
        name={cityName}
        required
        value={city}
        onChange={(event) => {
          setCity(event.target.value);
          setDistrict("");
        }}
      >
        <option value="" disabled>請選擇縣市</option>
        {taiwanCities.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
    <div className="field">
      <label htmlFor={`${idPrefix}-district`}>區域</label>
      <select
        className="input"
        id={`${idPrefix}-district`}
        name={districtName}
        required
        value={district}
        disabled={!city}
        onChange={(event) => setDistrict(event.target.value)}
      >
        <option value="" disabled>{city ? "請選擇區域" : "請先選擇縣市"}</option>
        {districts.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  </div>;
}
