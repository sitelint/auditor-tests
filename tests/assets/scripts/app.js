const onDocumentReady = () => {

  const handleSearchSuites = () => {
    const searchTestSuites = document.querySelector('#searchTestSuites');
    const tableRows = document.querySelectorAll('#testsListDialog table tbody tr');

    if (searchTestSuites === null || tableRows.length === 0) {
      return;
    }

    let timeoutId = null;

    const onChangeSearchTestSuites = (event) => {
      const input = event.target;
      const value = input.value.toLowerCase();
      const searchWords = value.split(' ');

      window.clearTimeout(timeoutId);

      timeoutId = window.setTimeout(() => {
        for (const row of tableRows) {
          const rowText = row.textContent.toLowerCase();
          let matchesAllWords = true;

          for (const word of searchWords) {
            if (rowText.includes(word) === false) {
              matchesAllWords = false;
              break;
            }
          }

          row.hidden = !matchesAllWords;
        };
      }, 500);
    };

    searchTestSuites.addEventListener('input', onChangeSearchTestSuites);
  };

  handleSearchSuites();
};

if (document.readyState !== 'loading') {
  onDocumentReady();
} else {
  window.addEventListener('DOMContentLoaded', onDocumentReady);
}
