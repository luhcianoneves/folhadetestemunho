import React, { useState, useCallback, useEffect } from 'react';

// Importa as bibliotecas jsPDF e html2canvas via CDN para uso no navegador
// Assegura que o ambiente React consiga usar estas bibliotecas globais
const { jsPDF } = window.jspdf;

// Componente principal da aplicação
function App() {
  // Estados para armazenar os dados do formulário
  const [dayImage, setDayImage] = useState(null); // Imagem do dia (File object)
  const [testimonyName, setTestimonyName] = useState(''); // Nome do Testemunho
  const [testimonyTime, setTestimonyTime] = useState(''); // Horário do Testemunho
  const [beforeText, setBeforeText] = useState(''); // Texto "Antes"
  const [afterText, setAfterText] = useState(''); // Texto "Depois"
  const [beforeImages, setBeforeImages] = useState([]); // Imagens "Antes" (Array de File objects)
  const [afterImages, setAfterImages] = useState([]); // Imagens "Depois" (Array de File objects)

  // Estados para armazenar as pré-visualizações das imagens (Data URLs)
  const [dayImagePreview, setDayImagePreview] = useState(null);
  const [beforeImagePreviews, setBeforeImagePreviews] = useState([]);
  const [afterImagePreviews, setAfterImagePreviews] = useState([]);

  // Estado para controlar o estado de carregamento durante a geração do PDF
  const [loading, setLoading] = useState(false);
  // Estado para exibir mensagens ao usuário
  const [message, setMessage] = useState('');

  // Função utilitária para converter um File object para Data URL (Base64)
  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  // Efeito para criar a pré-visualização da Imagem do Dia quando ela muda
  useEffect(() => {
    const updateDayImagePreview = async () => {
      setDayImagePreview(await fileToBase64(dayImage));
    };
    updateDayImagePreview();
  }, [dayImage, fileToBase64]);

  // Efeito para criar as pré-visualizações das Imagens Antes quando elas mudam
  useEffect(() => {
    const updateBeforeImagePreviews = async () => {
      const previews = await Promise.all(
        beforeImages.map((file) => fileToBase64(file))
      );
      setBeforeImagePreviews(previews.filter(Boolean)); // Remove nulos
    };
    updateBeforeImagePreviews();
  }, [beforeImages, fileToBase64]);

  // Efeito para criar as pré-visualizações das Imagens Depois quando elas mudam
  useEffect(() => {
    const updateAfterImagePreviews = async () => {
      const previews = await Promise.all(
        afterImages.map((file) => fileToBase64(file))
      );
      setAfterImagePreviews(previews.filter(Boolean)); // Remove nulos
    };
    updateAfterImagePreviews();
  }, [afterImages, fileToBase64]);

  // Manipulador para uploads de imagem única (Imagem do dia)
  const handleDayImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDayImage(file);
    } else {
      setDayImage(null);
    }
  };

  // Manipulador para uploads de múltiplas imagens (Imagens Antes/Depois)
  const handleMultipleImagesChange = (setter) => (e) => {
    const files = Array.from(e.target.files).slice(0, 10); // Limita a 10 imagens
    setter(files);
  };

  // Função principal para gerar o PDF
  const generatePdf = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      // Cria um novo documento jsPDF com tamanho A4 e orientação retrato (padrão)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageHeight = doc.internal.pageSize.height; // Altura da página A4
      const pageWidth = doc.internal.pageSize.width;   // Largura da página A4
      const margin = 15; // Margem para todos os lados
      let currentY = margin; // Posição Y atual no documento

      // Adiciona uma borda à página
      doc.setDrawColor(0); // Cor da borda preta
      doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');

      // 1. Imagem do dia (Logo)
      if (dayImagePreview) {
        // Tenta calcular as dimensões para que a imagem caiba e mantenha a proporção
        const imgData = dayImagePreview;
        const imgWidth = 40; // Largura desejada para o logo
        const imgHeight = (imgWidth / doc.getImageProperties(imgData).width) * doc.getImageProperties(imgData).height;
        const imgX = (pageWidth - imgWidth) / 2; // Centraliza a imagem
        doc.addImage(imgData, 'JPEG', imgX, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10; // Avança a posição Y
      }

      // 2. Nome do Testemunho ao lado da primeira foto do Depois
      let firstAfterImageAdded = false;
      if (testimonyName || afterImagePreviews.length > 0) {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const textWidth = doc.getStringUnitWidth(testimonyName) * doc.getFontSize() / doc.internal.scaleFactor;
        const availableWidth = pageWidth - 2 * margin;

        let imgWidth = 0;
        let imgHeight = 0;
        if (afterImagePreviews.length > 0) {
          const imgData = afterImagePreviews[0];
          imgWidth = 60; // Largura da primeira imagem do Depois
          imgHeight = (imgWidth / doc.getImageProperties(imgData).width) * doc.getImageProperties(imgData).height;
          // Garante que a imagem não seja muito alta
          if (imgHeight > 80) { // Limite máximo de altura para esta imagem
            imgHeight = 80;
            imgWidth = (imgHeight / doc.getImageProperties(imgData).height) * doc.getImageProperties(imgData).width;
          }
        }

        const combinedWidth = textWidth + imgWidth + 5; // 5mm de espaço entre texto e imagem
        let textX = margin;
        let imgX = margin + textWidth + 5;

        // Ajusta a posição se o conteúdo for muito largo para caber no centro
        if (combinedWidth > availableWidth) {
            // Se for muito grande, tenta alinhar à esquerda
            textX = margin;
            imgX = margin + textWidth + 5;
        } else {
            // Centraliza o bloco
            textX = (pageWidth - combinedWidth) / 2;
            imgX = textX + textWidth + 5;
        }


        if (currentY + Math.max(doc.getLineHeight() * 1.5, imgHeight) > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
        }

        doc.text(testimonyName, textX, currentY + (imgHeight / 2) - (doc.getLineHeight() / 2)); // Centraliza verticalmente com a imagem
        if (afterImagePreviews.length > 0) {
          doc.addImage(afterImagePreviews[0], 'JPEG', imgX, currentY, imgWidth, imgHeight);
          firstAfterImageAdded = true;
        }
        currentY += Math.max(doc.getLineHeight() * 1.5, imgHeight) + 10; // Adiciona espaço extra abaixo
      }

      // 3. Horário do Testemunho
      if (testimonyTime) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        if (currentY + doc.getLineHeight() * 1.5 > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
        }
        doc.text(`Horário: ${testimonyTime}`, margin, currentY);
        currentY += 8; // Espaço após o horário
      }

      // 4. Texto "Antes"
      if (beforeText) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Antes:', margin, currentY);
        currentY += 7; // Espaço após o título
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(beforeText, pageWidth - 2 * margin);
        let textHeight = splitText.length * doc.getLineHeight();

        // Verifica se o texto cabe na página, se não, adiciona nova página
        if (currentY + textHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
          doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
        }
        doc.text(splitText, margin, currentY);
        currentY += textHeight + 10; // Avança a posição Y
      }

      // 5. Texto "Depois"
      if (afterText) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Depois:', margin, currentY);
        currentY += 7; // Espaço após o título
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(afterText, pageWidth - 2 * margin);
        let textHeight = splitText.length * doc.getLineHeight();

        if (currentY + textHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
          doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
        }
        doc.text(splitText, margin, currentY);
        currentY += textHeight + 10; // Avança a posição Y
      }

      // 6. Imagens "Antes"
      if (beforeImagePreviews.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        if (currentY + 10 > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
        }
        doc.text('Imagens Antes:', margin, currentY);
        currentY += 7; // Espaço após o título
        doc.setFont('helvetica', 'normal');

        const imgWidth = (pageWidth - 3 * margin) / 2; // Duas imagens por linha
        const imgSpacing = 5; // Espaçamento entre imagens
        let rowMaxHeight = 0;

        for (let i = 0; i < beforeImagePreviews.length; i++) {
          const imgData = beforeImagePreviews[i];
          const originalImgProps = doc.getImageProperties(imgData);
          const originalRatio = originalImgProps.width / originalImgProps.height;
          let calculatedHeight = imgWidth / originalRatio;

          // Limita a altura máxima para evitar imagens muito longas
          const maxHeight = 80;
          if (calculatedHeight > maxHeight) {
              calculatedHeight = maxHeight;
          }
          // Garante que a largura calculada se ajuste à nova altura
          let currentImgWidth = calculatedHeight * originalRatio;


          // Se a imagem atual (ou a próxima na mesma linha) não couber, adicione uma nova página
          if (currentY + calculatedHeight > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
          }

          if (i % 2 === 0) { // Primeira imagem da linha
            if (i > 0) { // Se não for a primeira imagem total, avança para a próxima linha
              currentY += rowMaxHeight + imgSpacing;
            }
            rowMaxHeight = calculatedHeight;
            doc.addImage(imgData, 'JPEG', margin, currentY, currentImgWidth, calculatedHeight);
          } else { // Segunda imagem da linha
            const xPos = margin + imgWidth + imgSpacing;
            rowMaxHeight = Math.max(rowMaxHeight, calculatedHeight);
            doc.addImage(imgData, 'JPEG', xPos, currentY, currentImgWidth, calculatedHeight);
            currentY += rowMaxHeight + imgSpacing; // Próxima linha
            rowMaxHeight = 0; // Reseta para a próxima linha
          }
        }
        if (beforeImagePreviews.length % 2 !== 0) { // Se houver um número ímpar de imagens, finalize a linha
            currentY += rowMaxHeight + imgSpacing;
        }
        currentY += 10;
      }

      // 7. Imagens "Depois" (excluindo a primeira se já usada)
      const startIndex = firstAfterImageAdded ? 1 : 0; // Começa da segunda imagem se a primeira já foi usada
      if (afterImagePreviews.slice(startIndex).length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        if (currentY + 10 > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
        }
        doc.text('Imagens Depois:', margin, currentY);
        currentY += 7; // Espaço após o título
        doc.setFont('helvetica', 'normal');

        const imgWidth = (pageWidth - 3 * margin) / 2; // Duas imagens por linha
        const imgSpacing = 5; // Espaçamento entre imagens
        let rowMaxHeight = 0;

        for (let i = startIndex; i < afterImagePreviews.length; i++) {
          const imgData = afterImagePreviews[i];
          const originalImgProps = doc.getImageProperties(imgData);
          const originalRatio = originalImgProps.width / originalImgProps.height;
          let calculatedHeight = imgWidth / originalRatio;

          const maxHeight = 80;
          if (calculatedHeight > maxHeight) {
              calculatedHeight = maxHeight;
          }
          let currentImgWidth = calculatedHeight * originalRatio;

          // Se a imagem atual (ou a próxima na mesma linha) não couber, adicione uma nova página
          if (currentY + calculatedHeight > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            doc.rect(margin - 2, margin - 2, pageWidth - (2 * (margin - 2)), pageHeight - (2 * (margin - 2)), 'S');
          }

          const relativeIndex = i - startIndex;
          if (relativeIndex % 2 === 0) { // Primeira imagem da linha
            if (relativeIndex > 0) { // Se não for a primeira imagem total, avança para a próxima linha
              currentY += rowMaxHeight + imgSpacing;
            }
            rowMaxHeight = calculatedHeight;
            doc.addImage(imgData, 'JPEG', margin, currentY, currentImgWidth, calculatedHeight);
          } else { // Segunda imagem da linha
            const xPos = margin + imgWidth + imgSpacing;
            rowMaxHeight = Math.max(rowMaxHeight, calculatedHeight);
            doc.addImage(imgData, 'JPEG', xPos, currentY, currentImgWidth, calculatedHeight);
            currentY += rowMaxHeight + imgSpacing; // Próxima linha
            rowMaxHeight = 0; // Reseta para a próxima linha
          }
        }
        if ((afterImagePreviews.slice(startIndex).length) % 2 !== 0) {
            currentY += rowMaxHeight + imgSpacing;
        }
      }

      // Salva o PDF
      doc.save('Folha_de_Testemunho.pdf');
      setMessage('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setMessage('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    } finally {
      setLoading(false);
    }
  }, [dayImagePreview, testimonyName, testimonyTime, beforeText, afterText, beforeImagePreviews, afterImagePreviews, fileToBase64]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-inter">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-3xl border border-gray-200">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Folha de Testemunho</h1>

        <form onSubmit={(e) => { e.preventDefault(); generatePdf(); }}>
          {/* Imagem do Dia */}
          <div className="mb-6 border p-4 rounded-md bg-gray-50">
            <label htmlFor="dayImage" className="block text-lg font-medium text-gray-700 mb-2">
              Imagem do Dia:
            </label>
            <input
              type="file"
              id="dayImage"
              accept="image/*"
              onChange={handleDayImageChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {dayImagePreview && (
              <div className="mt-4 flex justify-center">
                <img src={dayImagePreview} alt="Pré-visualização da Imagem do Dia" className="max-w-xs h-32 object-contain rounded-md border border-gray-300" />
              </div>
            )}
          </div>

          {/* Nome do Testemunho */}
          <div className="mb-6">
            <label htmlFor="testimonyName" className="block text-lg font-medium text-gray-700 mb-2">
              Nome do Testemunho:
            </label>
            <input
              type="text"
              id="testimonyName"
              value={testimonyName}
              onChange={(e) => setTestimonyName(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Ex: Cura de Doença Grave"
            />
          </div>

          {/* Horário do Testemunho */}
          <div className="mb-6">
            <label htmlFor="testimonyTime" className="block text-lg font-medium text-gray-700 mb-2">
              Horário do Testemunho:
            </label>
            <input
              type="text"
              id="testimonyTime"
              value={testimonyTime}
              onChange={(e) => setTestimonyTime(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Ex: 14:30 - 20/06/2024"
            />
          </div>

          {/* Antes */}
          <div className="mb-6">
            <label htmlFor="beforeText" className="block text-lg font-medium text-gray-700 mb-2">
              Antes:
            </label>
            <textarea
              id="beforeText"
              value={beforeText}
              onChange={(e) => setBeforeText(e.target.value)}
              maxLength={5000}
              rows={6}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Descreva a situação antes do testemunho (máximo 5000 caracteres)."
            ></textarea>
            <p className="text-sm text-gray-500 mt-1 text-right">
              {beforeText.length}/5000 caracteres
            </p>
          </div>

          {/* Depois */}
          <div className="mb-6">
            <label htmlFor="afterText" className="block text-lg font-medium text-gray-700 mb-2">
              Depois:
            </label>
            <textarea
              id="afterText"
              value={afterText}
              onChange={(e) => setAfterText(e.target.value)}
              maxLength={5000}
              rows={6}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Descreva a situação depois do testemunho (máximo 5000 caracteres)."
            ></textarea>
            <p className="text-sm text-gray-500 mt-1 text-right">
              {afterText.length}/5000 caracteres
            </p>
          </div>

          {/* Imagens Antes */}
          <div className="mb-6 border p-4 rounded-md bg-gray-50">
            <label htmlFor="beforeImages" className="block text-lg font-medium text-gray-700 mb-2">
              Imagens Antes (até 10):
            </label>
            <input
              type="file"
              id="beforeImages"
              accept="image/*"
              multiple
              onChange={handleMultipleImagesChange(setBeforeImages)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {beforeImagePreviews.map((src, index) => (
                <div key={index} className="relative aspect-w-1 aspect-h-1">
                  <img src={src} alt={`Pré-visualização Antes ${index + 1}`} className="object-cover w-full h-full rounded-md border border-gray-300" />
                </div>
              ))}
            </div>
          </div>

          {/* Imagens Depois */}
          <div className="mb-6 border p-4 rounded-md bg-gray-50">
            <label htmlFor="afterImages" className="block text-lg font-medium text-gray-700 mb-2">
              Imagens Depois (até 10):
            </label>
            <input
              type="file"
              id="afterImages"
              accept="image/*"
              multiple
              onChange={handleMultipleImagesChange(setAfterImages)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {afterImagePreviews.map((src, index) => (
                <div key={index} className="relative aspect-w-1 aspect-h-1">
                  <img src={src} alt={`Pré-visualização Depois ${index + 1}`} className="object-cover w-full h-full rounded-md border border-gray-300" />
                </div>
              ))}
            </div>
          </div>

          {/* Botão de Gerar PDF */}
          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 transition duration-300 ease-in-out
                         flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <span>Gerar PDF</span>
              )}
            </button>
          </div>

          {/* Mensagens de feedback */}
          {message && (
            <p className={`mt-4 text-center text-sm ${message.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;
