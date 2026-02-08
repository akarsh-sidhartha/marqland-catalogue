import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Check, FolderPlus, X, ChevronDown, Search, Trash2, Pencil, RotateCcw, Info, CheckSquare, Square } from 'lucide-react';

/**
 * Custom Creatable Select to replace 'react-select/creatable' 
 */
const CustomCreatableSelect = ({ options, value, onChange, placeholder, isDisabled, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (val) => {
    onChange({ value: val, label: val });
    setIsOpen(false);
    setInputValue('');
  };

  const handleCreate = () => {
    if (inputValue.trim()) {
      onChange({ value: inputValue, label: inputValue });
      setIsOpen(false);
      setInputValue('');
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">{label}</label>
      <div 
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        className={`w-full border rounded-lg p-2 flex items-center justify-between cursor-pointer bg-white ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-indigo-300'}`}
      >
        <span className="text-sm truncate">{value ? value.label : (placeholder || 'Select...')}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[150] w-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <div className="p-2 border-b sticky top-0 bg-white">
            <input 
              autoFocus
              className="w-full p-2 text-xs border rounded-md outline-none focus:ring-1 ring-indigo-500"
              placeholder="Search or type new..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
          </div>
          {options.filter(o => o.label.toLowerCase().includes(inputValue.toLowerCase())).map((opt, idx) => (
            <div 
              key={idx}
              onClick={() => handleSelect(opt.value)}
              className="p-2 text-xs hover:bg-indigo-50 cursor-pointer"
            >
              {opt.label}
            </div>
          ))}
          {inputValue && !options.some(o => o.label.toLowerCase() === inputValue.toLowerCase()) && (
            <div 
              onClick={handleCreate}
              className="p-2 text-xs text-indigo-600 font-bold hover:bg-indigo-50 cursor-pointer border-t"
            >
              Create "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

  const getBaseUrl = () => {
    const { hostname } = window.location;
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
      ? 'localhost' 
      : hostname;
    return `http://${host}:5000/api`;
  };

  const API_URL_PRODUCTS = `${getBaseUrl()}/products`;
  const API_URL_PRODUCTS_CATALOGUE = `${getBaseUrl()}/catalogues`;

const ProductList = () => {
  const [products, setProducts] = useState([]);
  // Fixed state structure: using 'subCategories' as per backend update
  const [meta, setMeta] = useState({ brands: [], categories: [], subCategories: {} });
  const [availableSubCats, setAvailableSubCats] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [previewProduct, setPreviewProduct] = useState(null);

  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [savedCatalogues, setSavedCatalogues] = useState([]);
  const [isUpdatingCatalogue, setIsUpdatingCatalogue] = useState(false);

  const [formData, setFormData] = useState({
    brand: '', category: '', subCategory: '', name: '', description: '', purchasePrice: '', markupPercent: 30 
  });
  const [imageFile, setImageFile] = useState(null);
  const [filters, setFilters] = useState({ 
    brand: '', category: '', subCategory: '', minPrice: '', maxPrice: '', searchTerm: '' 
  });

  const fetchData = async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        axios.get(API_URL_PRODUCTS),
        axios.get(API_URL_PRODUCTS+`/meta`)
      ]);
      setProducts(pRes.data || []);
      // The backend uses 'subCategories', ensure we handle both keys for robustness
      const metaData = mRes.data || { brands: [], categories: [], subCategories: {} };
      if (metaData.subCategoryMap && !metaData.subCategories) {
          metaData.subCategories = metaData.subCategoryMap;
      }
      setMeta(metaData);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => {
    setFilters({ brand: '', category: '', subCategory: '', minPrice: '', maxPrice: '', searchTerm: '' });
  };

  const resetForm = () => {
    setFormData({ brand: '', category: '', subCategory: '', name: '', description: '', purchasePrice: '', markupPercent: 30 });
    setImageFile(null);
    setIsEditing(false);
    setCurrentId(null);
    setAvailableSubCats([]);
  };

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleProductSelection = (product) => {
    const isSelected = selectedProducts.find(p => p._id === product._id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p._id !== product._id));
    } else {
      setSelectedProducts([...selectedProducts, {
        _id: product._id,
        name: product.name,
        imageUrl: product.imageUrl,
        description: product.description,
        price: calculateSellingPrice(product.purchasePrice, product.markupPercent)
      }]);
    }
  };

  const selectAllInCategory = (categoryProducts) => {
    const allSelected = categoryProducts.every(p => selectedProducts.some(sp => sp._id === p._id));
    
    if (allSelected) {
      const categoryIds = categoryProducts.map(p => p._id);
      setSelectedProducts(selectedProducts.filter(sp => !categoryIds.includes(sp._id)));
    } else {
      const newSelections = [...selectedProducts];
      categoryProducts.forEach(p => {
        if (!newSelections.some(sp => sp._id === p._id)) {
          newSelections.push({
            _id: p._id,
            name: p.name,
            imageUrl: p.imageUrl,
            description: p.description,
            price: calculateSellingPrice(p.purchasePrice, p.markupPercent)
          });
        }
      });
      setSelectedProducts(newSelections);
    }
  };

  const handleOpenBuilder = () => {
    const dataToSave = selectedProducts.map(p => ({
      _id: p._id, name: p.name, imageUrl: p.imageUrl, description: p.description, price: p.price 
    }));
    localStorage.setItem('catalogue_selection', JSON.stringify(dataToSave));
    window.open('/builder', '_blank');
  };

  const openAddToExistingModal = async () => {
    setShowCatalogueModal(true);
    try {
     const res = await axios.get(API_URL_PRODUCTS_CATALOGUE);
      setSavedCatalogues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch catalogues", err);
      setSavedCatalogues([]);
    }
  };

  const appendToCatalogue = async (targetCat) => {
    if (!targetCat || isUpdatingCatalogue) return;
    setIsUpdatingCatalogue(true);
    try {
      const newItemsMapped = selectedProducts.map(p => ({
        name: p.name || 'Unnamed Product',
        description: p.description || '',
        price: p.price || 0,
        imageUrl: p.imageUrl || ''
      }));
      const updatedPayload = {
        id: targetCat._id,
        name: targetCat.name,
        subtitle: targetCat.subtitle,
        items: [...(targetCat.items || []), ...newItemsMapped]
      };
      await axios.post(API_URL_PRODUCTS_CATALOGUE, updatedPayload);
      setSelectedProducts([]);
      setShowCatalogueModal(false);
    } catch (err) {
      console.error("Error updating catalogue: ", err);
    } finally {
      setIsUpdatingCatalogue(false);
    }
  };

  // Fixed handleCategoryChange for Modal
  const handleCategoryChange = (v) => {
    const selectedCat = v ? v.value : '';
    setFormData({ ...formData, category: selectedCat, subCategory: '' });
    // Check both potential keys for subcategories
    const subCats = (meta.subCategories && meta.subCategories[selectedCat]) || (meta.subCategoryMap && meta.subCategoryMap[selectedCat]) || [];
    setAvailableSubCats(subCats.map(s => ({ label: s, value: s })));
  };

  const calculateSellingPrice = (buy, mark) => {
    const price = parseFloat(buy || 0);
    const markup = parseFloat(mark || 0);
    return (price + (price * markup / 100)).toFixed(0);
  };

  const handleSave = async () => {
    try {
      const data = new FormData();
      data.append('brand', formData.brand);
      data.append('category', formData.category);
      data.append('subCategory', formData.subCategory);
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('purchasePrice', formData.purchasePrice);
      data.append('markupPercent', formData.markupPercent);
      if (imageFile) data.append('image', imageFile);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEditing) {
        await axios.put(`${API_URL_PRODUCTS}/${currentId}`, data, config);
      } else {
        await axios.post(API_URL_PRODUCTS, data, config);
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try { 
        await axios.delete(API_URL_PRODUCTS+`/${id}`);
        fetchData();
        setSelectedProducts(prev => prev.filter(p => p._id !== id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };

  const handleEditClick = (p) => {
    setIsEditing(true);
    setCurrentId(p._id);
    setFormData({
      brand: p.brand || '',
      category: p.category || '',
      subCategory: p.subCategory || '',
      name: p.name || '',
      description: p.description || '',
      purchasePrice: p.purchasePrice || '',
      markupPercent: p.markupPercent || 30
    });
    
    const subCats = (meta.subCategories && p.category && meta.subCategories[p.category]) || 
                    (meta.subCategoryMap && p.category && meta.subCategoryMap[p.category]) || [];
    setAvailableSubCats(subCats.map(s => ({ label: s, value: s })));
    setShowModal(true);
  };

  const filteredProducts = products.filter(p => {
    const sPrice = parseFloat(calculateSellingPrice(p.purchasePrice, p.markupPercent));
    const min = filters.minPrice === '' ? 0 : parseFloat(filters.minPrice);
    const max = filters.maxPrice === '' ? Infinity : parseFloat(filters.maxPrice);
    const s = filters.searchTerm.toLowerCase();
    const matchesSearch = p.name?.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s);

    return (
      matchesSearch &&
      (filters.brand === '' || p.brand === filters.brand) &&
      (filters.category === '' || p.category === filters.category) &&
      (filters.subCategory === '' || p.subCategory === filters.subCategory) &&
      (sPrice >= min && sPrice <= max)
    );
  });

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const cat = product.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto p-4 pb-28 min-h-screen bg-gray-50/50">
      <div className="sticky top-0 z-40 bg-gray-50/50 pb-2">
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 border-r pr-3 border-gray-100 flex-shrink-0">
          <h1 className="text-xs font-black text-indigo-600 uppercase tracking-tighter">Catalogue</h1>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center transition flex-shrink-0">
            <Plus size={18} />
          </button>
        </div>

        <div className="relative flex-shrink-0 w-32 md:w-40 lg:w-48">
          <input 
            type="text" 
            placeholder="Search..."
            className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-100 focus:border-indigo-300 outline-none text-xs bg-gray-50/50"
            value={filters.searchTerm}
            onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
          />
          <Search size={12} className="absolute left-2.5 top-2.5 text-gray-300" />
          {filters.searchTerm && (
            <button 
                onClick={() => setFilters({...filters, searchTerm: ''})}
                className="absolute right-2 top-2.5 text-gray-300 hover:text-indigo-600"
            >
                <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-grow min-w-max">
          <select className="border border-gray-100 p-2 rounded-lg text-[10px] font-bold bg-white outline-none min-w-[90px]" value={filters.brand} onChange={e => setFilters({...filters, brand: e.target.value})}>
            <option value="">All Brands</option>
            {meta.brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          
          <select className="border border-gray-100 p-2 rounded-lg text-[10px] font-bold bg-white outline-none min-w-[100px]" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value, subCategory: ''})}>
            <option value="">All Categories</option>
            {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            disabled={!filters.category}
            className={`border border-gray-100 p-2 rounded-lg text-[10px] font-bold outline-none min-w-[100px] transition-opacity ${!filters.category ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'bg-white'}`} 
            value={filters.subCategory} 
            onChange={e => setFilters({...filters, subCategory: e.target.value})}
          >
            <option value="">All Sub Cats</option>
            {/* Added safety check to prevent crash on undefined category key */}
            {filters.category && (meta.subCategories?.[filters.category] || meta.subCategoryMap?.[filters.category])?.map(s => (
                <option key={s} value={s}>{s}</option>
            ))}
          </select>
          
          <button 
            onClick={resetFilters}
            className="p-2 text-gray-300 hover:text-indigo-600 transition-colors flex-shrink-0"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex-shrink-0 ml-auto">
          <span className="text-[9px] font-black text-gray-400 uppercase">₹</span>
          <input type="number" placeholder="Min" className="w-10 bg-transparent text-[10px] font-bold outline-none" value={filters.minPrice} onChange={e => setFilters({...filters, minPrice: e.target.value})} />
          <span className="text-gray-300">-</span>
          <input type="number" placeholder="Max" className="w-10 bg-transparent text-[10px] font-bold outline-none" value={filters.maxPrice} onChange={e => setFilters({...filters, maxPrice: e.target.value})} />
        </div>
      </div>
      </div>

      {selectedProducts.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col border-r border-gray-700 pr-6">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Selection</span>
            <span className="text-lg font-bold leading-none">{selectedProducts.length} Items</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedProducts([])} className="text-[10px] font-black text-gray-400 hover:text-red-400 uppercase tracking-wider transition-colors">Deselect All</button>
            <button onClick={openAddToExistingModal} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider border border-gray-600 transition flex items-center gap-2">
              <FolderPlus size={14} className="text-indigo-400" />
              Add to Existing
            </button>
            <button onClick={handleOpenBuilder} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition transform active:scale-95 flex items-center gap-2">
              Build New
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {Object.keys(groupedProducts).length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest">No Products Found</div>
      ) : (
        Object.keys(groupedProducts).sort().map(category => {
          const isCollapsed = collapsedCategories[category];
          const categoryProducts = groupedProducts[category];
          const isAllInCategorySelected = categoryProducts.every(p => selectedProducts.some(sp => sp._id === p._id));

          return (
            <div key={category} className="mb-10">
              <div className="flex items-center gap-4 mb-4 group">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCategory(category)}>
                  <span className={`text-gray-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
                  <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest whitespace-nowrap group-hover:text-indigo-600 transition-colors">
                    {category} ({categoryProducts.length})
                  </h2>
                </div>

                <button 
                    onClick={() => selectAllInCategory(categoryProducts)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter transition-all ${
                      isAllInCategorySelected 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'
                    }`}
                >
                  {isAllInCategorySelected ? <CheckSquare size={12} /> : <Square size={12} />}
                  {isAllInCategorySelected ? 'All Selected' : 'Select All'}
                </button>

                <div className="h-[1px] w-full bg-gray-100 flex-grow"></div>
              </div>

              {!isCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {categoryProducts.map(p => {
                    const isSelected = selectedProducts.some(sp => sp._id === p._id);
                    return (
                      <div key={p._id} className={`bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col relative transition-all duration-200 ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}>
                        <div 
                            className={`absolute top-2 right-2 z-20 cursor-pointer w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/80 border-gray-300 text-transparent'}`}
                            onClick={() => toggleProductSelection(p)}
                        >
                            <Check size={14} strokeWidth={4} />
                        </div>
                        <div 
                          className="h-32 bg-gray-50 flex items-center justify-center relative overflow-hidden cursor-zoom-in group/img"
                          onClick={() => setPreviewProduct(p)}
                        >
                            {p.imageUrl && <img src={`http://${window.location.hostname || 'localhost'}:5000${p.imageUrl}`} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />}
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                <Info size={20} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        <div className="p-3 flex-grow flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-xs text-gray-800 leading-tight line-clamp-2 mb-2">
                                  <span className="text-indigo-500 uppercase inline-block mr-1.5 font-black">{p.brand}</span>
                                  {p.name}
                                </h3>
                                <div className="flex items-center justify-between text-[10px] bg-gray-50 p-1.5 rounded-lg mb-2">
                                    <div><span className="text-gray-400 block font-bold uppercase text-[7px]">Cost</span><span className="text-gray-600 font-bold">₹{p.purchasePrice}</span></div>
                                    <div className="text-right"><span className="text-gray-400 block font-bold uppercase text-[7px]">Markup</span><span className="text-indigo-600 font-black">+{p.markupPercent}%</span></div>
                                </div>
                            </div>
                            <div className="flex justify-between items-end mt-1">
                                <div><span className="text-gray-400 block font-bold uppercase text-[7px]">Sale Price</span><span className="text-sm font-black text-green-600">₹{calculateSellingPrice(p.purchasePrice, p.markupPercent)}</span></div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEditClick(p)} className="p-1.5 hover:bg-indigo-50 text-indigo-400 rounded transition" title="Edit"><Pencil size={13} /></button>
                                    <button onClick={() => handleDelete(p._id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded transition" title="Delete"><Trash2 size={13} /></button>
                                </div>
                            </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Catalogue Modals and Popups */}
      {showCatalogueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-modal-up">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Select Catalogue</h2>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Appending {selectedProducts.length} items</p>
              </div>
              <button onClick={() => setShowCatalogueModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
              {!savedCatalogues || savedCatalogues.length === 0 ? (
                <div className="text-center py-10"><p className="text-gray-400 text-sm italic">No saved catalogues found.</p></div>
              ) : (
                savedCatalogues.map(cat => (
                  <button key={cat._id} disabled={isUpdatingCatalogue} onClick={() => appendToCatalogue(cat)} className="w-full text-left p-5 rounded-3xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all flex justify-between items-center group disabled:opacity-50">
                    <div>
                      <h4 className="font-black text-gray-800 uppercase group-hover:text-indigo-600 transition-colors">{cat.name}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{(cat.items || []).length} current items</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><Plus size={18} /></div>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 bg-gray-50"><button onClick={() => setShowCatalogueModal(false)} className="w-full py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Cancel</button></div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800 uppercase">{isEditing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CustomCreatableSelect label="Brand" isDisabled={isEditing} options={meta.brands.map(b => ({label: b, value: b}))} value={formData.brand ? {label: formData.brand, value: formData.brand} : null} onChange={(v) => setFormData({...formData, brand: v?.value})} />
                <CustomCreatableSelect label="Category" isDisabled={isEditing} options={meta.categories.map(c => ({label: c, value: c}))} value={formData.category ? {label: formData.category, value: formData.category} : null} onChange={handleCategoryChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <CustomCreatableSelect label="Sub Category" isDisabled={isEditing || !formData.category} value={formData.subCategory ? {label: formData.subCategory, value: formData.subCategory} : null} options={availableSubCats} onChange={(v) => setFormData({...formData, subCategory: v?.value})} />
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Name</label>
                  <input className="w-full border rounded-lg p-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Description</label>
                <textarea className="w-full border rounded-lg p-2 h-20 text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cost Price (₹)</label>
                  <input type="number" className="w-full border rounded-lg p-2 text-sm" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} />
                </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Image</label>
                    <input type="file" onChange={(e) => setImageFile(e.target.files[0])} className="text-[10px] mt-1" />
                    {isEditing && <p className="text-[8px] text-indigo-500 mt-1 italic">Leave empty to keep current</p>}
                  </div>
              </div>
              <div className="bg-indigo-50 p-6 rounded-xl">
                <div className="grid grid-cols-2 items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-indigo-900 uppercase mb-1">Margin (%)</label>
                    <select className="w-full border rounded-lg p-2 bg-white font-black" value={formData.markupPercent} onChange={e => setFormData({...formData, markupPercent: parseInt(e.target.value)})}>
                      {[10,15,20,25,30,35,40,45,50].map(m => <option key={m} value={m}>{m}%</option>)}
                    </select>
                  </div>
                  <div className="text-right">
                    <label className="block text-[11px] font-black text-indigo-900 uppercase">Final Selling Price</label>
                    <div className="text-3xl font-black text-green-600">₹{calculateSellingPrice(formData.purchasePrice, formData.markupPercent)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400 font-bold uppercase text-xs">Cancel</button>
              <button onClick={handleSave} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs hover:bg-indigo-700 shadow-lg">{isEditing ? 'Update Settings' : 'Save Product'}</button>
            </div>
          </div>
        </div>
      )}

      {previewProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex items-center justify-center p-4" onClick={() => setPreviewProduct(null)}>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-modal-up" onClick={e => e.stopPropagation()}>
            <div className="relative h-64 bg-gray-100">
               {previewProduct.imageUrl && <img src={`http://${window.location.hostname || 'localhost'}:5000${previewProduct.imageUrl}`} alt={previewProduct.name} className="w-full h-full object-cover" />}
               <button onClick={() => setPreviewProduct(null)} className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full text-gray-800 shadow-sm hover:bg-white transition-colors">
                 <X size={20} />
               </button>
            </div>
            <div className="p-8">
              <div className="mb-4">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">{previewProduct.brand}</span>
                <h2 className="text-2xl font-black text-gray-900 leading-tight uppercase tracking-tighter">{previewProduct.name}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">{previewProduct.description || 'No description available.'}</p>
              <div className="flex justify-between items-center border-t pt-6">
                <div>
                    <span className="text-gray-400 block font-bold uppercase text-[10px]">Price</span>
                    <span className="text-3xl font-black text-green-600">₹{calculateSellingPrice(previewProduct.purchasePrice, previewProduct.markupPercent)}</span>
                </div>
                <button onClick={() => { toggleProductSelection(previewProduct); setPreviewProduct(null); }} className={`px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${selectedProducts.some(p => p._id === previewProduct._id) ? 'bg-red-50 text-red-500' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>
                    {selectedProducts.some(p => p._id === previewProduct._id) ? 'Remove Selection' : 'Select Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modal-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-modal-up {
          animation: modal-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ProductList;