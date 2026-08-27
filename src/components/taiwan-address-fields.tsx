"use client";

import { useState } from "react";
import { districtsForCity, taiwanCities } from "@/lib/taiwan-address";
import { RoundedSelect } from "./rounded-select";

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
  const cityOptions = [{ value: "", label: "請選擇縣市" }, ...taiwanCities.map((option) => ({ value: option, label: option }))];
  const districtOptions = [{ value: "", label: city ? "請選擇區域" : "請先選擇縣市" }, ...districts.map((option) => ({ value: option, label: option }))];

  return <div className={className}>
    <div className="field">
      <label htmlFor={`${idPrefix}-city`}>縣市</label>
      <RoundedSelect id={`${idPrefix}-city`} name={cityName} options={cityOptions} value={city} onValueChange={(value) => { setCity(value); setDistrict(""); }} ariaLabel="縣市" />
    </div>
    <div className="field">
      <label htmlFor={`${idPrefix}-district`}>區域</label>
      <RoundedSelect id={`${idPrefix}-district`} name={districtName} options={districtOptions} value={district} onValueChange={setDistrict} disabled={!city} ariaLabel="區域" />
    </div>
  </div>;
}
