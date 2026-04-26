/**
 * indiaLocations.js
 * Shared location data for India — states and major cities.
 * Import anywhere: import { INDIA_STATES, CITIES_BY_STATE, ALL_INDIA_CITIES } from './indiaLocations';
 *
 * Usage with LocationSelects component (also exported here):
 *   <LocationSelects
 *     country={country} onCountryChange={setCountry}
 *     state={state}   onStateChange={setState}
 *     city={city}     onCityChange={setCity}
 *   />
 */

// ─── Countries (India at top, then alphabetical) ────────────────────────────
export const COUNTRIES = [
  'India',
  'Afghanistan', 'Australia', 'Bahrain', 'Bangladesh', 'Belgium', 'Brazil',
  'Canada', 'China', 'Denmark', 'Egypt', 'France', 'Germany', 'Hong Kong',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan',
  'Kenya', 'Kuwait', 'Malaysia', 'Maldives', 'Mexico', 'Myanmar', 'Nepal',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan',
  'Philippines', 'Portugal', 'Qatar', 'Russia', 'Saudi Arabia', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Taiwan', 'Thailand', 'Turkey', 'UAE', 'United Kingdom', 'United States',
  'Vietnam',
];

// ─── India States & UTs (alphabetical) ─────────────────────────────────────
export const INDIA_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

// ─── Cities grouped by state ────────────────────────────────────────────────
export const CITIES_BY_STATE = {
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool',
    'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur',
    'Vizianagaram', 'Eluru', 'Ongole', 'Nandyal', 'Chittoor',
  ],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
  'Assam': [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon',
    'Tinsukia', 'Tezpur', 'Bongaigaon', 'Dhubri',
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia',
    'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar',
    'Munger', 'Chapra', 'Saharsa', 'Sitamarhi', 'Hajipur',
  ],
  'Chandigarh': ['Chandigarh'],
  'Chhattisgarh': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg',
    'Rajnandgaon', 'Jagdalpur', 'Raigarh', 'Ambikapur',
  ],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Silvassa', 'Diu'],
  'Delhi': [
    'New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Janakpuri',
    'Laxmi Nagar', 'Pitampura', 'Saket', 'Vasant Kunj', 'Karol Bagh',
    'Connaught Place', 'Nehru Place', 'Noida (NCR)', 'Gurugram (NCR)',
  ],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar',
    'Jamnagar', 'Gandhinagar', 'Junagadh', 'Anand', 'Mehsana',
    'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch',
    'Porbandar', 'Amreli', 'Valsad',
  ],
  'Haryana': [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar',
    'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula',
    'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Kurukshetra',
  ],
  'Himachal Pradesh': [
    'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Kangra', 'Baddi',
  ],
  'Jammu and Kashmir': [
    'Srinagar', 'Jammu', 'Baramulla', 'Anantnag', 'Sopore',
    'Kathua', 'Udhampur', 'Punch',
  ],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar',
    'Hazaribagh', 'Giridih', 'Dumka', 'Chaibasa',
  ],
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Dharwad',
    'Belagavi', 'Davanagere', 'Ballari', 'Shivamogga', 'Tumkuru',
    'Raichur', 'Bidar', 'Kalaburagi', 'Hassan', 'Udupi',
    'Vijayapura', 'Bagalkot', 'Koppal', 'Mandya', 'Chitradurga',
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam',
    'Palakkad', 'Alappuzha', 'Malappuram', 'Kannur', 'Kottayam',
    'Kasaragod', 'Pathanamthitta', 'Idukki', 'Wayanad',
  ],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti'],
  'Madhya Pradesh': [
    'Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain',
    'Sagar', 'Rewa', 'Satna', 'Dewas', 'Murwara (Katni)',
    'Chhindwara', 'Ratlam', 'Singrauli', 'Burhanpur', 'Bhind',
    'Morena', 'Guna', 'Shivpuri', 'Vidisha', 'Damoh',
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik',
    'Aurangabad', 'Solapur', 'Amravati', 'Kolhapur', 'Navi Mumbai',
    'Vasai-Virar', 'Malegaon', 'Jalgaon', 'Latur', 'Dhule',
    'Ahmednagar', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Nanded',
    'Sangli', 'Satara', 'Ratnagiri', 'Akola', 'Yavatmal',
  ],
  'Manipur': ['Imphal', 'Thoubal', 'Kakching'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai'],
  'Mizoram': ['Aizawl', 'Lunglei'],
  'Nagaland': ['Kohima', 'Dimapur'],
  'Odisha': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur',
    'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda',
    'Jeypore', 'Bargarh',
  ],
  'Puducherry': ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'],
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda',
    'Mohali', 'Hoshiarpur', 'Pathankot', 'Moga', 'Firozpur',
    'Sangrur', 'Fatehgarh Sahib', 'Rupnagar', 'Phagwara',
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer',
    'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sri Ganganagar',
    'Sikar', 'Pali', 'Nagaur', 'Tonk', 'Barmer',
    'Jhunjhunu', 'Churu', 'Hanumangarh', 'Sawai Madhopur',
  ],
  'Sikkim': ['Gangtok', 'Namchi', 'Geyzing'],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
    'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Tiruppur',
    'Thanjavur', 'Dindigul', 'Kancheepuram', 'Cuddalore', 'Nagercoil',
    'Pudukkottai', 'Krishnagiri', 'Namakkal', 'Dharmapuri', 'Ramanathapuram',
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam',
    'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet',
    'Siddipet', 'Vikarabad', 'Miryalaguda', 'Mancherial',
  ],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar'],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi',
    'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad',
    'Saharanpur', 'Noida', 'Firozabad', 'Loni', 'Gorakhpur',
    'Jhansi', 'Mathura', 'Rampur', 'Muzaffarnagar', 'Shahjahanpur',
    'Farrukhabad', 'Sitapur', 'Hapur', 'Etawah', 'Sambhal',
    'Amroha', 'Bulandshahr', 'Unnao', 'Jaunpur', 'Ayodhya',
  ],
  'Uttarakhand': [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur',
    'Kashipur', 'Rishikesh', 'Mussoorie', 'Nainital', 'Almora',
  ],
  'West Bengal': [
    'Kolkata', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman',
    'Malda', 'Barasat', 'Krishnanagar', 'Medinipur', 'Howrah',
    'Haldia', 'Jalpaiguri', 'Bankura', 'Purulia', 'Cooch Behar',
    'Raiganj', 'Balurghat', 'Kharagpur',
  ],
};

// Flat list of all cities (sorted, no duplicates)
export const ALL_INDIA_CITIES = [
  ...new Set(Object.values(CITIES_BY_STATE).flat()),
].sort();

// ─── Searchable Select Component ────────────────────────────────────────────
// A dropdown with an inline search box. Renders as a styled <select>-like
// popover with keyboard-accessible filtering.
//
// Props:
//   value, onChange, options (string[]), placeholder, label, disabled
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export const SearchableSelect = ({
  value, onChange, options = [], placeholder = 'Select…',
  label, disabled = false, className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) { inputRef.current.focus(); setQuery(''); }
  }, [open]);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const select = (opt) => { onChange(opt); setOpen(false); };
  const clear = (e) => { e.stopPropagation(); onChange(''); };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          {label}
        </label>
      )}
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          border rounded-lg px-3 py-2 text-sm text-left
          outline-none transition bg-white
          ${disabled ? 'opacity-50 cursor-not-allowed border-slate-200' : 'cursor-pointer hover:border-indigo-300 focus:border-indigo-400'}
          ${open ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-slate-200'}
        `}
      >
        <span className={value ? 'text-slate-800 font-medium' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span onClick={clear}
              className="p-0.5 text-slate-300 hover:text-slate-500 rounded transition">
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="
          absolute z-[300] mt-1 w-full bg-white border border-slate-200
          rounded-xl shadow-xl overflow-hidden
          animate-[fadeIn_0.1s_ease]
        ">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search size={12} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-xs outline-none text-slate-700 placeholder-slate-400 bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-300 hover:text-slate-500">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No results</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`
                    w-full text-left px-3 py-2 text-sm transition
                    ${opt === value
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── LocationSelects — Country + State + City group ─────────────────────────
// Drop-in replacement for plain text inputs.
// State list only shows when country === 'India'.
// City list cascades from selected state (India) or shows empty for others.
//
// Props:
//   country, onCountryChange
//   state,   onStateChange
//   city,    onCityChange
//   showCountry (bool, default true) — hide country picker for India-only forms
// ─────────────────────────────────────────────────────────────────────────────
export const LocationSelects = ({
  country, onCountryChange,
  state, onStateChange,
  city, onCityChange,
  showCountry = true,
}) => {
  const isIndia = !country || country === 'India';

  // When country changes, reset state+city
  const handleCountry = (c) => {
    onCountryChange(c);
    onStateChange('');
    onCityChange('');
  };

  // When state changes, reset city
  const handleState = (s) => {
    onStateChange(s);
    onCityChange('');
  };

  const cityOptions = isIndia
    ? (state ? (CITIES_BY_STATE[state] || []) : ALL_INDIA_CITIES)
    : [];

  return (
    <div className="grid grid-cols-1 gap-3">
      {showCountry && (
        <SearchableSelect
          label="Country"
          value={country}
          onChange={handleCountry}
          options={COUNTRIES}
          placeholder="India"
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        {isIndia ? (
          <SearchableSelect
            label="State"
            value={state}
            onChange={handleState}
            options={INDIA_STATES}
            placeholder="Select State"
          />
        ) : (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">State / Province</label>
            <input
              value={state}
              onChange={e => onStateChange(e.target.value)}
              placeholder="Enter state"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition"
            />
          </div>
        )}
        {isIndia ? (
          <SearchableSelect
            label="City"
            value={city}
            onChange={onCityChange}
            options={cityOptions}
            placeholder={state ? 'Select City' : 'Select City'}
          />
        ) : (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">City</label>
            <input
              value={city}
              onChange={e => onCityChange(e.target.value)}
              placeholder="Enter city"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition"
            />
          </div>
        )}
      </div>
    </div>
  );
};