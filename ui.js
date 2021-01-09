$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $favoriteArticles = $("#favorited-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");

  // font awesome icons
  const HEART_FALSE = '<i class="far fa-heart fav-button"></i>'
  const HEART_TRUE = '<i class="fas fa-heart fav-button fav"></i>'

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event handler for setting/unsetting a favourite
   * article, by user toggling heart icon
   */

  $("body").on("click",".fav-button", async function(){
    // select heart icon & story, then toggle it's class
    let heart = $(this);
    let story = heart.parent()[0];
    heart.toggleClass("fav");

    
    let action = heart.hasClass("fav");
    
    //action = True  -> toggleFavorite will set to fav
    //action = False -> toggleFavorite will remove from fav
    currentUser = await User.toggleFavorite(story.id, action)
    
    // change heart icon on the story and refresh fav section
    heart.replaceWith(action ? $(HEART_TRUE) : $(HEART_FALSE));
    generateFavorites();
    
  });

  /**
   * Event handler for deleting user's own story
   */

  $("body").on("click", ".del-but", async function(){
    let story = $(this).parent()[0];
    
    // delete the story and return the updated User instance
    currentUser = await StoryList.deleteStory(story.id);
    
    // if it was a favorited story, refresh the favs section
    if($(`#${story.id} i`).hasClass('fav')){
      generateFavorites();
    }
    story.remove(); // remove from DOM
  });


  /**
   * Event handler for Submit form to Create New Story
   */

  $submitForm.on("submit", async function(evt){
    evt.preventDefault(); // no page refresh on submit

    // ensure user is logged in
    if(!currentUser.username){
      return alert("You must log in to perform this action.");
    }

    // extract form values and submit to fxn for api call
    let author = $("#author").val();
    let title = $("#title").val();
    let url = $("#url").val();
    await StoryList.addStory({ author, title, url });
    
    // refresh story feed & reset user form
    await generateStories();
    $submitForm.trigger("reset");
  })

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    if (token && username){
      currentUser = await User.getLoggedInUser(token, username);
    }
    
    await generateStories(); // generate main story feed

    if (currentUser) {
      // if user logged in, show custom logged in components
      showNavForLoggedInUser();
      $submitForm.show();
      await generateFavorites();
      $favoriteArticles.show();
      // updated user information at the bottom of the page
      $("#profile-name").append(currentUser.name);
      $("#profile-username").append(currentUser.username);
      $("#profile-account-date").append(currentUser.createdAt);
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  async function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories & custom logged in info
    $allStoriesList.show();
    $submitForm.show();
    await generateFavorites();
    $favoriteArticles.show();
    // updated user information at the bottom of the page
    $("#profile-name").append(currentUser.name);
    $("#profile-username").append(currentUser.username);
    $("#profile-account-date").append(currentUser.createdAt);
    
    

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A rendering function to pull favorites off the existingUser 
   * global variable, then render it to Favorites List. Called 
   * for only for logged in users.
   */

  function generateFavorites(){
    $favoriteArticles.empty();

    // if content exists, render, else, render "empty" statement
    if(currentUser.favorites[0]){
      for (let fav of currentUser.favorites){
        const result = generateStoryHTML(fav);
        $favoriteArticles.append(result);
      };
    } else {
      $favoriteArticles.append("<li>..Empty..</li>");
    };
  };

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);
    let favStatus = HEART_FALSE; // not favorited by default
    let delBut = ""; // create variable incase it's user's own story
    
    currentUser.favorites.map(fav => {
      if (fav.storyId == story.storyId){
        favStatus = HEART_TRUE; // set heart icon to favorited
      }
    })

    if (story.username == currentUser.username){ // if own story, add button
      delBut = '<button class="del-but">Delete Story</button>';
    }

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${favStatus}
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
        ${delBut}
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
