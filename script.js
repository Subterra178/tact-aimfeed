
const selects = document.querySelectorAll(".play-link select");
selects.forEach((select)=>{
    select.addEventListener("change",(e)=>{
        const group = select.closest(".play-link");
        const link = group.querySelector(".play-link a"); 
        const href = e.target.value;
        if(href){
            link.href=href;
        }
    });
});